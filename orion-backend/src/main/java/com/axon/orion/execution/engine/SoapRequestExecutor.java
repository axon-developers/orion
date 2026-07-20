package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.config.OrionSslContextFactory;
import com.axon.orion.admin.service.SystemSettingsService;
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
public class SoapRequestExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.SOAP_REQUEST);
    }

    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;
    private final SystemSettingsService systemSettingsService;
    private final OrionSslContextFactory orionSslContextFactory;

    public SoapRequestExecutor(
            ObjectMapper objectMapper,
            EncryptionService encryptionService,
            SystemSettingsService systemSettingsService,
            OrionSslContextFactory orionSslContextFactory
    ) {
        this.objectMapper = objectMapper;
        this.encryptionService = encryptionService;
        this.systemSettingsService = systemSettingsService;
        this.orionSslContextFactory = orionSslContextFactory;
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String url = VariableInterpolator.resolve((String) config.get("url"), context);
        String soapAction = (String) config.get("soapAction");
        String envelope = VariableInterpolator.resolve((String) config.get("envelope"), context);
        int timeoutMs = ((Number) config.getOrDefault("timeoutMs", 30000)).intValue();

        // Resolve custom headers (if any)
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
                log.warn("Failed to parse headers JSON string in SOAP step {}: {}", step.getName(), e.getMessage());
            }
        }
        Map<String, String> headers = resolveStringMap(rawHeaders, context);

        Map<String, Object> inputPayload = new LinkedHashMap<>();
        inputPayload.put("url", url);
        inputPayload.put("soapAction", soapAction);
        inputPayload.put("headers", headers);
        inputPayload.put("envelope", envelope);

        // Fetch SSLContext for environment
        // Resolve final context: use common Orion truststore/keystore context
        SSLContext effectiveSslContext = orionSslContextFactory.getOrionSslContext();

        // Build dynamically configured RestClient to support proxy and SSL custom settings
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
                clientBuilder.proxy(com.axon.orion.common.util.ProxyUtils.createProxySelector(proxyHost, proxyPort, proxyType, nonProxyHosts));
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
                .build();

        long reqStart = System.currentTimeMillis();
        try {
            RestClient.RequestBodySpec requestSpec = restClient.method(HttpMethod.POST)
                    .uri(url);

            // Add standard SOAP headers and allow overriding with custom headers
            requestSpec.header(HttpHeaders.ACCEPT, "*/*");
            String version = (String) config.getOrDefault("soapVersion", "SOAP_1_1");
            if ("SOAP_1_2".equals(version)) {
                requestSpec.header(HttpHeaders.CONTENT_TYPE, "application/soap+xml; charset=utf-8");
            } else {
                requestSpec.header(HttpHeaders.CONTENT_TYPE, "text/xml; charset=utf-8");
                String actionVal = (soapAction != null) ? soapAction.trim() : "";
                if (!actionVal.startsWith("\"") && !actionVal.endsWith("\"")) {
                    actionVal = "\"" + actionVal + "\"";
                }
                requestSpec.header("SOAPAction", actionVal);
            }

            // Apply custom headers (can override default Content-Type/SOAPAction if needed)
            headers.forEach(requestSpec::header);

            if (envelope != null) {
                requestSpec.body(envelope);
            }

            ResponseEntity<String> response = requestSpec
                    .retrieve()
                    .toEntity(String.class);

            long duration = System.currentTimeMillis() - reqStart;
            context.put("__lastResponseTimeMs", String.valueOf(duration));

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", response.getStatusCode().value());
            output.put("headers", response.getHeaders().toSingleValueMap());
            output.put("body", response.getBody());

            context.put("__lastStatusCode", String.valueOf(response.getStatusCode().value()));
            context.put("__lastResponseBody", response.getBody() != null ? response.getBody() : "");

            return StepResult.passed(output);
        } catch (RestClientResponseException e) {
            long duration = System.currentTimeMillis() - reqStart;
            context.put("__lastResponseTimeMs", String.valueOf(duration));

            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("statusCode", e.getStatusCode().value());
            errorOutput.put("headers", e.getResponseHeaders() != null ? e.getResponseHeaders().toSingleValueMap() : Map.of());
            errorOutput.put("body", e.getResponseBodyAsString());

            context.put("__lastStatusCode", String.valueOf(e.getStatusCode().value()));
            context.put("__lastResponseBody", e.getResponseBodyAsString());

            return StepResult.failed("SOAP request failed with status: " + e.getStatusCode().value() + " " + e.getStatusText(), errorOutput);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - reqStart;
            context.put("__lastResponseTimeMs", String.valueOf(duration));

            log.error("SOAP execution error: {}", e.getMessage(), e);
            return StepResult.failed("SOAP request error: " + e.getMessage(), Map.of());
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
