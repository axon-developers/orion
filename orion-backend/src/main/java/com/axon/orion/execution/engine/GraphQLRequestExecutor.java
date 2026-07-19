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
public class GraphQLRequestExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.GRAPHQL_REQUEST);
    }

    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;
    private final SystemSettingsService systemSettingsService;
    private final OrionSslContextFactory orionSslContextFactory;

    public GraphQLRequestExecutor(ObjectMapper objectMapper,
            EncryptionService encryptionService, SystemSettingsService systemSettingsService,
            OrionSslContextFactory orionSslContextFactory) {
        this.objectMapper = objectMapper;
        this.encryptionService = encryptionService;
        this.systemSettingsService = systemSettingsService;
        this.orionSslContextFactory = orionSslContextFactory;
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String url = VariableInterpolator.resolve((String) config.get("url"), context);
        String query = VariableInterpolator.resolve((String) config.get("query"), context);
        
        // Resolve variables JSON
        Map<String, Object> variables = new LinkedHashMap<>();
        Object varsObj = config.get("variables");
        if (varsObj instanceof Map) {
            try {
                String rawVarsJson = objectMapper.writeValueAsString(varsObj);
                String resolvedVarsJson = VariableInterpolator.resolve(rawVarsJson, context);
                variables = objectMapper.readValue(resolvedVarsJson, new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.warn("Failed to interpolate GraphQL variables map in step {}: {}", step.getName(), e.getMessage());
            }
        } else if (varsObj instanceof String str && !str.trim().isEmpty()) {
            try {
                String resolvedVarsJson = VariableInterpolator.resolve(str, context);
                variables = objectMapper.readValue(resolvedVarsJson, new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.warn("Failed to parse/interpolate GraphQL variables JSON string in step {}: {}", step.getName(), e.getMessage());
            }
        }

        // Resolve Headers
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

        int timeoutMs = ((Number) config.getOrDefault("timeoutMs", 30000)).intValue();
        int retries = ((Number) config.getOrDefault("retries", 0)).intValue();
        int retryIntervalMs = ((Number) config.getOrDefault("retryIntervalMs", 1000)).intValue();

        // Build GraphQL payload body: {"query": "...", "variables": {...}}
        Map<String, Object> graphqlBody = new LinkedHashMap<>();
        graphqlBody.put("query", query);
        graphqlBody.put("variables", variables);
        if (config.containsKey("operationName")) {
            graphqlBody.put("operationName", config.get("operationName"));
        }

        Map<String, Object> inputPayload = new LinkedHashMap<>();
        inputPayload.put("url", url);
        inputPayload.put("query", query);
        inputPayload.put("variables", variables);
        inputPayload.put("headers", headers);

        // Resolve final context: use common Orion truststore/keystore context
        SSLContext effectiveSslContext = orionSslContextFactory.getOrionSslContext();

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
                    clientBuilder.authenticator(new Authenticator() {
                        @Override
                        protected PasswordAuthentication getPasswordAuthentication() {
                            return new PasswordAuthentication(proxyUsername, proxyPassword.toCharArray());
                        }
                    });
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
                    log.info("Retrying GraphQL request for step '{}' (attempt {} of {}) after {}ms", step.getName(), attempt, retries, retryIntervalMs);
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

                RestClient.RequestBodySpec requestSpec = restClient.method(HttpMethod.POST)
                        .uri(url);

                headers.forEach(requestSpec::header);

                boolean hasAccept = headers.keySet().stream().anyMatch(h -> h.equalsIgnoreCase(HttpHeaders.ACCEPT));
                if (!hasAccept) {
                    requestSpec.header(HttpHeaders.ACCEPT, "*/*");
                }

                requestSpec.body(graphqlBody);

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
            log.error("GraphQL Request failed: {}", errorMsg, otherException);
            return StepResult.failed("GraphQL Request failed: " + errorMsg, inputPayload);
        }
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
