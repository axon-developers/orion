package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
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
public class HttpRequestExecutor {

    private final EnvironmentRepository environmentRepository;
    private final RestClient defaultRestClient;
    private final Map<String, RestClient> restClientCache = new ConcurrentHashMap<>();

    public HttpRequestExecutor(EnvironmentRepository environmentRepository) {
        this.environmentRepository = environmentRepository;
        this.defaultRestClient = RestClient.builder()
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
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
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                rawHeaders = mapper.readValue(str, new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
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

        // Build URL with query params
        if (!queryParams.isEmpty()) {
            StringBuilder urlBuilder = new StringBuilder(url);
            urlBuilder.append("?");
            queryParams.forEach((k, v) -> urlBuilder.append(k).append("=").append(v).append("&"));
            url = urlBuilder.substring(0, urlBuilder.length() - 1);
        }

        Map<String, Object> inputPayload = new LinkedHashMap<>();
        inputPayload.put("url", url);
        inputPayload.put("method", method);
        inputPayload.put("headers", headers);
        inputPayload.put("body", body);

        // Fetch custom restClient if environment specifies client certificate or trust all ssl
        String envId = context.get("__environmentId");
        RestClient clientToUse = getRestClientForEnvironment(envId);

        try {
            RestClient.RequestBodySpec requestSpec = clientToUse.method(HttpMethod.valueOf(method.toUpperCase()))
                    .uri(url);

            // Add headers
            headers.forEach(requestSpec::header);

            // Add Accept: */* default if user did not specify one, preventing 406 Not Acceptable when retrieving as String
            boolean hasAccept = headers.keySet().stream().anyMatch(h -> h.equalsIgnoreCase(HttpHeaders.ACCEPT));
            if (!hasAccept) {
                requestSpec.header(HttpHeaders.ACCEPT, "*/*");
            }

            // Add body if applicable
            String bodyType = (String) config.getOrDefault("bodyType", "NONE");
            if (body != null && !bodyType.equals("NONE")) {
                if (body instanceof String s) {
                    requestSpec.body(s);
                } else {
                    requestSpec.body(body);
                }
            }

            ResponseEntity<String> response = requestSpec
                    .retrieve()
                    .toEntity(String.class);

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", response.getStatusCode().value());
            output.put("headers", response.getHeaders().toSingleValueMap());
            output.put("body", response.getBody());

            // Store response metadata in context for subsequent ASSERTION steps
            context.put("__lastStatusCode", String.valueOf(response.getStatusCode().value()));
            context.put("__lastResponseBody", response.getBody() != null ? response.getBody() : "");

            return StepResult.passed(output);
        } catch (RestClientResponseException e) {
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", e.getStatusCode().value());
            output.put("body", e.getResponseBodyAsString());

            context.put("__lastStatusCode", String.valueOf(e.getStatusCode().value()));
            context.put("__lastResponseBody", e.getResponseBodyAsString());

            return StepResult.passed(output); // HTTP errors are still "passed" — assertions decide pass/fail
        } catch (Exception e) {
            log.error("HTTP request failed: {}", e.getMessage());
            return StepResult.failed("HTTP request failed: " + e.getMessage(), inputPayload);
        }
    }

    private Map<String, String> resolveStringMap(Map<String, String> map, Map<String, String> context) {
        Map<String, String> resolved = new LinkedHashMap<>();
        map.forEach((k, v) -> resolved.put(k, VariableInterpolator.resolve(v, context)));
        return resolved;
    }

    private RestClient getRestClientForEnvironment(String envId) {
        if (envId == null) {
            return defaultRestClient;
        }

        try {
            Optional<Environment> envOpt = environmentRepository.findById(envId);
            if (envOpt.isEmpty()) {
                return defaultRestClient;
            }
            Environment env = envOpt.get();

            boolean hasCert = env.getSslClientCert() != null && !env.getSslClientCert().trim().isEmpty();
            boolean trustAll = env.isSslTrustAll();

            if (!hasCert && !trustAll) {
                return defaultRestClient;
            }

            String cacheKey = envId + ":" + env.getUpdatedAt();
            return restClientCache.computeIfAbsent(cacheKey, key -> buildCustomRestClient(env));
        } catch (Exception e) {
            log.warn("Failed to retrieve RestClient for environment {}: {}. Falling back to default.", envId, e.getMessage());
            return defaultRestClient;
        }
    }

    private RestClient buildCustomRestClient(Environment env) {
        try {
            SSLContext sslContext = createSSLContext(env);
            HttpClient.Builder clientBuilder = HttpClient.newBuilder()
                    .sslContext(sslContext);

            HttpClient httpClient = clientBuilder.build();
            JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);

            return RestClient.builder()
                    .requestFactory(requestFactory)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .build();
        } catch (Exception e) {
            log.error("Failed to build custom RestClient for environment {}: {}", env.getName(), e.getMessage());
            return defaultRestClient;
        }
    }

    private SSLContext createSSLContext(Environment env) throws Exception {
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

        KeyManager[] keyManagers = null;
        if (env.getSslClientCert() != null && !env.getSslClientCert().trim().isEmpty()) {
            byte[] keystoreBytes = Base64.getDecoder().decode(env.getSslClientCert().trim());
            char[] password = env.getSslClientCertPassword() != null ? env.getSslClientCertPassword().toCharArray() : new char[0];

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
