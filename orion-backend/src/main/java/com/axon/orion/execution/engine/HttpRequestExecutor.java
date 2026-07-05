package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import javax.net.ssl.*;
import java.io.ByteArrayInputStream;
import java.net.http.HttpClient;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class HttpRequestExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.HTTP_REQUEST);
    }

    private final EnvironmentRepository environmentRepository;
    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;
    private final Map<String, SSLContext> sslContextCache = new ConcurrentHashMap<>();
    private final SSLContext defaultSslContext;

    public HttpRequestExecutor(EnvironmentRepository environmentRepository, ObjectMapper objectMapper, EncryptionService encryptionService) {
        this.environmentRepository = environmentRepository;
        this.objectMapper = objectMapper;
        this.encryptionService = encryptionService;
        SSLContext dSsl = null;
        try {
            dSsl = SSLContext.getDefault();
        } catch (Exception e) {
            log.error("Failed to get default SSLContext: {}", e.getMessage());
        }
        this.defaultSslContext = dSsl;
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String url = VariableInterpolator.resolve((String) config.get("url"), context);
        String method = (String) config.getOrDefault("method", "GET");
        Map<String, String> rawHeaders = Map.of();
        Object headersObj = config.get("headers");
        if (headersObj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, String> map = (Map<String, String>) headersObj;
            rawHeaders = map;
        } else if (headersObj instanceof String str && !str.trim().isEmpty()) {
            try {
                rawHeaders = objectMapper.readValue(str, new TypeReference<Map<String, String>>() {});
            } catch (Exception e) {
                log.warn("Failed to parse headers JSON string in step {}: {}", step.getName(), e.getMessage());
            }
        }
        Map<String, String> headers = resolveStringMap(rawHeaders, context);
        @SuppressWarnings("unchecked")
        Map<String, String> queryParams = resolveStringMap(
                (Map<String, String>) config.getOrDefault("queryParams", Map.of()), context);
        Object body = config.get("body");
        int timeoutMs = ((Number) config.getOrDefault("timeoutMs", 30000)).intValue();
        int retries = ((Number) config.getOrDefault("retries", 0)).intValue();
        int retryIntervalMs = ((Number) config.getOrDefault("retryIntervalMs", 1000)).intValue();

        // Build URL with properly URL-encoded query params
        if (!queryParams.isEmpty()) {
            StringBuilder urlBuilder = new StringBuilder(url);
            urlBuilder.append("?");
            queryParams.forEach((k, v) -> {
                try {
                    urlBuilder.append(java.net.URLEncoder.encode(k, java.nio.charset.StandardCharsets.UTF_8))
                            .append("=")
                            .append(java.net.URLEncoder.encode(v, java.nio.charset.StandardCharsets.UTF_8))
                            .append("&");
                } catch (Exception e) {
                    urlBuilder.append(k).append("=").append(v).append("&");
                }
            });
            url = urlBuilder.substring(0, urlBuilder.length() - 1);
        }

        Map<String, Object> inputPayload = new LinkedHashMap<>();
        inputPayload.put("url", url);
        inputPayload.put("method", method);
        inputPayload.put("headers", headers);
        inputPayload.put("body", body);

        // Fetch SSLContext for environment
        String envId = context.get("__environmentId");
        String clientCertKey = (String) config.get("clientCertKey");
        SSLContext sslContext = getSSLContextForEnvironment(envId, clientCertKey);

        // Build dynamically configured RestClient to enforce custom timeouts per step
        HttpClient httpClient = HttpClient.newBuilder()
                .sslContext(sslContext != null ? sslContext : defaultSslContext)
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .build();

        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));

        RestClient restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        int attempt = 0;
        ResponseEntity<String> response = null;
        RestClientResponseException restException = null;
        Exception otherException = null;

        while (attempt <= retries) {
            if (attempt > 0) {
                try {
                    log.info("Retrying HTTP request for step '{}' (attempt {} of {}) after {}ms", step.getName(), attempt, retries, retryIntervalMs);
                    Thread.sleep(retryIntervalMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return StepResult.failed("Execution interrupted during retry back-off", inputPayload);
                }
            }

            try {
                restException = null;
                otherException = null;

                RestClient.RequestBodySpec requestSpec = restClient.method(HttpMethod.valueOf(method.toUpperCase()))
                        .uri(url);

                headers.forEach(requestSpec::header);

                boolean hasAccept = headers.keySet().stream().anyMatch(h -> h.equalsIgnoreCase(HttpHeaders.ACCEPT));
                if (!hasAccept) {
                    requestSpec.header(HttpHeaders.ACCEPT, "*/*");
                }

                String bodyType = (String) config.getOrDefault("bodyType", "NONE");
                if (body != null && !bodyType.equals("NONE")) {
                    if (body instanceof String s) {
                        requestSpec.body(s);
                    } else {
                        requestSpec.body(body);
                    }
                }

                response = requestSpec.retrieve().toEntity(String.class);

                int status = response.getStatusCode().value();
                if (status >= 500 && attempt < retries) {
                    attempt++;
                    continue;
                }
                break;
            } catch (RestClientResponseException e) {
                restException = e;
                int status = e.getStatusCode().value();
                if (status >= 500 && attempt < retries) {
                    attempt++;
                    continue;
                }
                break;
            } catch (Exception e) {
                otherException = e;
                if (attempt < retries) {
                    attempt++;
                    continue;
                }
                break;
            }
        }

        if (response != null) {
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", response.getStatusCode().value());
            output.put("headers", response.getHeaders().toSingleValueMap());
            output.put("body", response.getBody());

            context.put("__lastStatusCode", String.valueOf(response.getStatusCode().value()));
            context.put("__lastResponseBody", response.getBody() != null ? response.getBody() : "");

            return StepResult.passed(output);
        } else if (restException != null) {
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", restException.getStatusCode().value());
            output.put("headers", restException.getResponseHeaders() != null ? restException.getResponseHeaders().toSingleValueMap() : Map.of());
            output.put("body", restException.getResponseBodyAsString());

            context.put("__lastStatusCode", String.valueOf(restException.getStatusCode().value()));
            context.put("__lastResponseBody", restException.getResponseBodyAsString());

            return StepResult.passed(output);
        } else {
            String errorMsg = otherException != null ? otherException.getMessage() : "Unknown error";
            log.error("Http Request failed: {}", errorMsg, otherException);
            return StepResult.failed("Http Request failed: " + errorMsg, inputPayload);
        }
    }

    private Map<String, String> resolveStringMap(Map<String, String> map, Map<String, String> context) {
        Map<String, String> resolved = new LinkedHashMap<>();
        map.forEach((k, v) -> resolved.put(k, VariableInterpolator.resolve(v, context)));
        return resolved;
    }

    private SSLContext getSSLContextForEnvironment(String envId, String clientCertKey) {
        if (envId == null) {
            return defaultSslContext;
        }

        try {
            Optional<Environment> envOpt = environmentRepository.findById(envId);
            if (envOpt.isEmpty()) {
                return defaultSslContext;
            }
            Environment env = envOpt.get();

            String clientCertBase64 = null;
            if (clientCertKey != null && !clientCertKey.isBlank()) {
                EnvironmentCertificate targetCert = env.getCertificates().stream()
                        .filter(c -> clientCertKey.equals(c.getName()) || clientCertKey.equals(c.getId()))
                        .findFirst()
                        .orElse(null);
                if (targetCert != null) {
                    clientCertBase64 = targetCert.getClientCert();
                }
            }
            if (clientCertBase64 == null || clientCertBase64.isBlank()) {
                clientCertBase64 = env.getSslClientCert();
            }

            boolean hasCert = clientCertBase64 != null && !clientCertBase64.trim().isEmpty();
            boolean trustAll = env.isSslTrustAll();

            if (!hasCert && !trustAll) {
                return defaultSslContext;
            }

            String cacheKey = envId + ":" + env.getUpdatedAt() + ":" + (clientCertKey != null ? clientCertKey : "");
            return sslContextCache.computeIfAbsent(cacheKey, key -> {
                try {
                    return createSSLContext(env, clientCertKey);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
        } catch (Exception e) {
            log.warn("Failed to retrieve SSLContext for environment {}: {}. Falling back to default.", envId, e.getMessage());
            return defaultSslContext;
        }
    }

    private SSLContext createSSLContext(Environment env, String clientCertKey) throws Exception {
        TrustManager[] trustManagers;
        if (env.isSslTrustAll()) {
            trustManagers = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
        } else {
            trustManagers = null; // system default trust managers
        }

        String clientCertBase64 = null;
        String clientCertPassword = null;

        if (clientCertKey != null && !clientCertKey.isBlank()) {
            EnvironmentCertificate targetCert = env.getCertificates().stream()
                    .filter(c -> clientCertKey.equals(c.getName()) || clientCertKey.equals(c.getId()))
                    .findFirst()
                    .orElse(null);

            if (targetCert != null) {
                clientCertBase64 = targetCert.getClientCert();
                clientCertPassword = encryptionService.decrypt(targetCert.getClientCertPassword());
            }
        }

        // Fallback to environment default
        if (clientCertBase64 == null || clientCertBase64.isBlank()) {
            clientCertBase64 = env.getSslClientCert();
            clientCertPassword = encryptionService.decrypt(env.getSslClientCertPassword());
        }

        KeyManager[] keyManagers = null;
        if (clientCertBase64 != null && !clientCertBase64.trim().isEmpty()) {
            byte[] keystoreBytes = Base64.getDecoder().decode(clientCertBase64.trim());
            char[] password = clientCertPassword != null ? clientCertPassword.toCharArray() : new char[0];

            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            try (ByteArrayInputStream bis = new ByteArrayInputStream(keystoreBytes)) {
                keyStore.load(bis, password);
            }

            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(keyStore, password);
            keyManagers = kmf.getKeyManagers();
        }

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(keyManagers, trustManagers, new SecureRandom());
        return sslContext;
    }
}
