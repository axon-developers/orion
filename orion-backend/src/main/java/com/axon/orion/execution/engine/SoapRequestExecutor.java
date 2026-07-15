package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.common.service.EncryptionService;
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

    private final EnvironmentRepository environmentRepository;
    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;
    private final SystemSettingsService systemSettingsService;
    private final Map<String, SSLContext> sslContextCache = new ConcurrentHashMap<>();
    private final SSLContext defaultSslContext;

    public SoapRequestExecutor(
            EnvironmentRepository environmentRepository,
            ObjectMapper objectMapper,
            EncryptionService encryptionService,
            SystemSettingsService systemSettingsService
    ) {
        this.environmentRepository = environmentRepository;
        this.objectMapper = objectMapper;
        this.encryptionService = encryptionService;
        this.systemSettingsService = systemSettingsService;
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
        String envId = context.get("__environmentId");
        String clientCertKey = (String) config.get("clientCertKey");
        SSLContext sslContext = getSSLContextForEnvironment(envId, clientCertKey);

        // Build dynamically configured RestClient to support proxy and SSL custom settings
        HttpClient.Builder clientBuilder = HttpClient.newBuilder()
                .sslContext(sslContext != null ? sslContext : defaultSslContext)
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

    private SSLContext getSSLContextForEnvironment(String envId, String clientCertKey) {
        String clientCertBase64 = null;
        String clientCertPassword = null;
        boolean trustAll = false;
        String updateStamp = "";

        if (envId != null) {
            try {
                Optional<Environment> envOpt = environmentRepository.findById(envId);
                if (envOpt.isPresent()) {
                    Environment env = envOpt.get();
                    trustAll = env.isSslTrustAll();
                    updateStamp = String.valueOf(env.getUpdatedAt());

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
                    if (clientCertBase64 == null || clientCertBase64.isBlank()) {
                        clientCertBase64 = env.getSslClientCert();
                        clientCertPassword = encryptionService.decrypt(env.getSslClientCertPassword());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to retrieve environment certificate for ID {}: {}", envId, e.getMessage());
            }
        }

        // Orion self-HTTPS certificate fallback
        if ((clientCertBase64 == null || clientCertBase64.isBlank()) && systemSettingsService.getBoolean("orion.ssl.enabled", false)) {
            clientCertBase64 = systemSettingsService.getString("orion.ssl.keystore.base64", "");
            clientCertPassword = systemSettingsService.getString("orion.ssl.keystore.password", "");
        }

        boolean hasCert = clientCertBase64 != null && !clientCertBase64.trim().isEmpty();
        if (!hasCert && !trustAll) {
            return defaultSslContext;
        }

        String cacheKey = (envId != null ? envId : "global") + ":" + updateStamp + ":" + (clientCertKey != null ? clientCertKey : "") + ":" + hasCert + ":" + trustAll;
        final String finalCertBase64 = clientCertBase64;
        final String finalCertPassword = clientCertPassword;
        final boolean finalTrustAll = trustAll;

        return sslContextCache.computeIfAbsent(cacheKey, key -> {
            try {
                return createSSLContext(finalCertBase64, finalCertPassword, finalTrustAll);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    private SSLContext createSSLContext(String clientCertBase64, String clientCertPassword, boolean trustAll) throws Exception {
        TrustManager[] trustManagers;
        if (trustAll) {
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
        if (clientCertBase64 != null && !clientCertBase64.trim().isEmpty()) {
            byte[] keystoreBytes = Base64.getDecoder().decode(clientCertBase64.trim());
            char[] password = clientCertPassword != null ? clientCertPassword.toCharArray() : new char[0];

            KeyStore keyStore;
            try {
                keyStore = KeyStore.getInstance("PKCS12");
                try (ByteArrayInputStream bis = new ByteArrayInputStream(keystoreBytes)) {
                    keyStore.load(bis, password);
                }
            } catch (Exception e) {
                log.info("Keystore is not PKCS12, attempting to load as JKS format: {}", e.getMessage());
                keyStore = KeyStore.getInstance("JKS");
                try (ByteArrayInputStream bis = new ByteArrayInputStream(keystoreBytes)) {
                    keyStore.load(bis, password);
                }
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
