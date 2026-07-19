package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.config.OrionSslContextFactory;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.admin.service.SystemSettingsService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import java.net.Authenticator.RequestorType;

import javax.net.ssl.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.Authenticator;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
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

    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;
    private final SystemSettingsService systemSettingsService;
    private final OrionSslContextFactory orionSslContextFactory;
    private final AuthTokenExecutor authTokenExecutor;

    public HttpRequestExecutor(ObjectMapper objectMapper,
            EncryptionService encryptionService, SystemSettingsService systemSettingsService,
            OrionSslContextFactory orionSslContextFactory,
            @org.springframework.context.annotation.Lazy AuthTokenExecutor authTokenExecutor) {
        this.objectMapper = objectMapper;
        this.encryptionService = encryptionService;
        this.systemSettingsService = systemSettingsService;
        this.orionSslContextFactory = orionSslContextFactory;
        this.authTokenExecutor = authTokenExecutor;
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

        // Auto-refresh token if expired or expiring within 60s
        checkAndRefreshTokenIfNeeded(step, rawHeaders, context);

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
        // Resolve final context: use common Orion truststore/keystore context
        SSLContext effectiveSslContext = orionSslContextFactory.getOrionSslContext();

        boolean socksProxyCredentialsSet = false;
        try {
            // Build dynamically configured RestClient to enforce custom timeouts per step
            HttpClient.Builder clientBuilder = HttpClient.newBuilder()
                    .sslContext(effectiveSslContext)
                    .connectTimeout(Duration.ofMillis(timeoutMs));

            if (systemSettingsService.getBoolean("proxy.enabled", false)) {
                String proxyHost = systemSettingsService.getString("proxy.host", "");
                int proxyPort = systemSettingsService.getInt("proxy.port", 8080);
                String proxyType = systemSettingsService.getString("proxy.type", "HTTP");
                String nonProxyHosts = systemSettingsService.getString("proxy.nonProxyHosts", "");
                String proxyUsername = systemSettingsService.getString("proxy.username", "");
                String proxyPassword = systemSettingsService.getString("proxy.password", "");

                if (!proxyHost.isBlank()) {
                    clientBuilder.proxy(createProxySelector(proxyHost, proxyPort, proxyType, nonProxyHosts));
                    if (!proxyUsername.isBlank()) {
                        if ("SOCKS5".equalsIgnoreCase(proxyType)) {
                            System.setProperty("java.net.socks.username", proxyUsername);
                            System.setProperty("java.net.socks.password", proxyPassword);
                            socksProxyCredentialsSet = true;
                        } else {
                            clientBuilder.authenticator(new Authenticator() {
                                @Override
                                protected PasswordAuthentication getPasswordAuthentication() {
                                    if (getRequestorType() == RequestorType.PROXY) {
                                        return new PasswordAuthentication(proxyUsername, proxyPassword.toCharArray());
                                    }
                                    return null;
                                }
                            });
                        }
                    }
                }
            }
        HttpClient httpClient = clientBuilder.build();

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

            long reqStart = System.currentTimeMillis();
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
                    if ("FORM_URLENCODED".equalsIgnoreCase(bodyType) || (headers.containsKey(HttpHeaders.CONTENT_TYPE) && headers.get(HttpHeaders.CONTENT_TYPE).contains("x-www-form-urlencoded"))) {
                        if (body instanceof Map<?, ?> map) {
                            StringBuilder sb = new StringBuilder();
                            map.forEach((k, v) -> {
                                if (sb.length() > 0) sb.append("&");
                                try {
                                    sb.append(java.net.URLEncoder.encode(String.valueOf(k), java.nio.charset.StandardCharsets.UTF_8))
                                      .append("=")
                                      .append(java.net.URLEncoder.encode(String.valueOf(v), java.nio.charset.StandardCharsets.UTF_8));
                                } catch (Exception e) {
                                    sb.append(k).append("=").append(v);
                                }
                            });
                            requestSpec.body(sb.toString());
                        } else if (body instanceof String s) {
                            requestSpec.body(s);
                        }
                    } else if (body instanceof String s) {
                        requestSpec.body(s);
                    } else {
                        requestSpec.body(body);
                    }
                }

                response = requestSpec.retrieve().toEntity(String.class);
                long duration = System.currentTimeMillis() - reqStart;
                context.put("__lastResponseTimeMs", String.valueOf(duration));

                int status = response.getStatusCode().value();
                if (status >= 500 && attempt < retries) {
                    attempt++;
                    continue;
                }
                break;
            } catch (RestClientResponseException e) {
                long duration = System.currentTimeMillis() - reqStart;
                context.put("__lastResponseTimeMs", String.valueOf(duration));
                restException = e;
                int status = e.getStatusCode().value();
                if (status >= 500 && attempt < retries) {
                    attempt++;
                    continue;
                }
                break;
            } catch (Exception e) {
                long duration = System.currentTimeMillis() - reqStart;
                context.put("__lastResponseTimeMs", String.valueOf(duration));
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
        } finally {
            if (socksProxyCredentialsSet) {
                System.clearProperty("java.net.socks.username");
                System.clearProperty("java.net.socks.password");
            }
        }
    }

    private void checkAndRefreshTokenIfNeeded(TestStep step, Map<String, String> rawHeaders, Map<String, String> context) {
        if (authTokenExecutor == null || context == null) return;
        
        for (String val : rawHeaders.values()) {
            if (val == null) continue;
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:\\{\\{|\\$\\{)([^}]+)(?:\\}\\}|\\})").matcher(val);
            while (m.find()) {
                String varName = m.group(1).trim();
                String configKey = "__auth_config_" + varName;
                String expiresKey = varName + "_expiresAt";

                if (context.containsKey(configKey) && context.containsKey(expiresKey)) {
                    try {
                        long expiresAt = Long.parseLong(context.get(expiresKey));
                        if (System.currentTimeMillis() >= expiresAt - 60000) {
                            log.info("[AUTO-REFRESH] Token '{}' is expiring/expired (expiresAt={}). Automatically refreshing auth token...", varName, expiresAt);
                            forceRefreshTokenForStep(step, varName, context);
                        }
                    } catch (Exception e) {
                        log.warn("[AUTO-REFRESH] Failed to check token expiry for '{}': {}", varName, e.getMessage());
                    }
                }
            }
        }
    }

    private boolean forceRefreshTokenForStep(TestStep step, String varName, Map<String, String> context) {
        String configKey = "__auth_config_" + varName;
        String rawConfigJson = context.get(configKey);
        if (rawConfigJson == null) return false;

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> authConfig = objectMapper.readValue(rawConfigJson, Map.class);
            StepResult res = authTokenExecutor.execute(step, authConfig, context);
            if (res.passed() && res.extractedVariables() != null) {
                for (StepResult.ExtractedVariable v : res.extractedVariables()) {
                    context.put(v.key(), v.value());
                }
                log.info("[AUTO-REFRESH] Successfully refreshed auth token '{}'. New expiration: {}", varName, context.get(varName + "_expiresAt"));
                return true;
            }
        } catch (Exception e) {
            log.error("[AUTO-REFRESH] Failed to auto-refresh auth token '{}': {}", varName, e.getMessage(), e);
        }
        return false;
    }

    private Map<String, String> resolveStringMap(Map<String, String> map, Map<String, String> context) {
        Map<String, String> resolved = new LinkedHashMap<>();
        map.forEach((k, v) -> resolved.put(k, VariableInterpolator.resolve(v, context)));
        return resolved;
    }

    private ProxySelector createProxySelector(String proxyHost, int proxyPort, String proxyType, String nonProxyHosts) {
        Proxy.Type type = "SOCKS5".equalsIgnoreCase(proxyType) ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
        Proxy proxy = new Proxy(type, new InetSocketAddress(proxyHost, proxyPort));
        List<String> bypassHosts = nonProxyHosts != null ? Arrays.stream(nonProxyHosts.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList() : List.of();
        return new ProxySelector() {
            @Override
            public List<Proxy> select(URI uri) {
                String host = uri.getHost();
                if (host != null) {
                    for (String bypass : bypassHosts) {
                        if (host.equalsIgnoreCase(bypass) || host.endsWith("." + bypass)) {
                            return List.of(Proxy.NO_PROXY);
                        }
                    }
                }
                return List.of(proxy);
            }
            @Override
            public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
                log.warn("Proxy connection failed for URI {}: {}", uri, ioe.getMessage());
            }
        };
    }
}
