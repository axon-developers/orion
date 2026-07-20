package com.axon.orion.execution.engine;

import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.config.OrionSslContextFactory;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.net.Authenticator;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Component
public class AuthTokenExecutor implements StepExecutor {

    private final ObjectMapper objectMapper;
    private final OrionSslContextFactory orionSslContextFactory;
    private final SystemSettingsService systemSettingsService;

    public AuthTokenExecutor(ObjectMapper objectMapper,
                             OrionSslContextFactory orionSslContextFactory,
                             SystemSettingsService systemSettingsService) {
        this.objectMapper = objectMapper;
        this.orionSslContextFactory = orionSslContextFactory;
        this.systemSettingsService = systemSettingsService;
    }

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.AUTH_TOKEN);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String authType = (String) config.getOrDefault("authType", "BASIC");
        String rawTargetVariable = (String) config.getOrDefault("targetVariable", "authToken");
        String targetVariable = VariableInterpolator.resolve(rawTargetVariable, context);
        if (targetVariable == null || targetVariable.isBlank()) {
            targetVariable = "authToken";
        }
        
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("authType", authType);
        output.put("targetVariable", targetVariable);

        try {
            String tokenValue = null;
            long expiresInSeconds = 1800; // Default 30 mins (1800 seconds)

            if ("BASIC".equalsIgnoreCase(authType)) {
                String username = VariableInterpolator.resolve((String) config.get("username"), context);
                String password = VariableInterpolator.resolve((String) config.get("password"), context);
                if (username == null || password == null) {
                    return StepResult.failed("Username and Password are required for Basic Auth", output);
                }
                String base64 = Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
                tokenValue = "Basic " + base64;
                expiresInSeconds = 86400; // 24 hours
                output.put("message", "Generated Basic Auth token successfully");
                
            } else if ("OAUTH2_CLIENT_CREDENTIALS".equalsIgnoreCase(authType) || "OAUTH2_PASSWORD".equalsIgnoreCase(authType)) {
                String tokenUrl = VariableInterpolator.resolve((String) config.get("tokenUrl"), context);
                String clientId = VariableInterpolator.resolve((String) config.get("clientId"), context);
                String clientSecret = VariableInterpolator.resolve((String) config.get("clientSecret"), context);
                String scope = VariableInterpolator.resolve((String) config.get("scope"), context);
                
                if (tokenUrl == null || tokenUrl.isBlank()) {
                    return StepResult.failed("Token URL is required for OAuth2", output);
                }

                StringBuilder bodyBuilder = new StringBuilder();
                if ("OAUTH2_CLIENT_CREDENTIALS".equalsIgnoreCase(authType)) {
                    bodyBuilder.append("grant_type=client_credentials");
                } else {
                    String username = VariableInterpolator.resolve((String) config.get("username"), context);
                    String password = VariableInterpolator.resolve((String) config.get("password"), context);
                    bodyBuilder.append("grant_type=password")
                               .append("&username=").append(URLEncoder.encode(username != null ? username : "", StandardCharsets.UTF_8))
                               .append("&password=").append(URLEncoder.encode(password != null ? password : "", StandardCharsets.UTF_8));
                }

                if (clientId != null && !clientId.isBlank()) {
                    bodyBuilder.append("&client_id=").append(URLEncoder.encode(clientId, StandardCharsets.UTF_8));
                }
                if (clientSecret != null && !clientSecret.isBlank()) {
                    bodyBuilder.append("&client_secret=").append(URLEncoder.encode(clientSecret, StandardCharsets.UTF_8));
                }
                if (scope != null && !scope.isBlank()) {
                    bodyBuilder.append("&scope=").append(URLEncoder.encode(scope, StandardCharsets.UTF_8));
                }

                RestClient client = buildRestClient();
                String responseBody = client.post()
                        .uri(tokenUrl)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(bodyBuilder.toString())
                        .retrieve()
                        .body(String.class);

                JsonNode node = objectMapper.readTree(responseBody);
                if (node.has("access_token")) {
                    String token = node.get("access_token").asText();
                    String tokenType = node.has("token_type") ? node.get("token_type").asText() : "Bearer";
                    tokenValue = tokenType + " " + token;
                    if (node.has("expires_in") && node.get("expires_in").isNumber()) {
                        expiresInSeconds = node.get("expires_in").asLong();
                    }
                    output.put("token_type", tokenType);
                    output.put("expires_in", expiresInSeconds);
                    output.put("message", "Fetched OAuth2 access token successfully (valid for " + expiresInSeconds + "s)");
                } else {
                    return StepResult.failed("OAuth2 response did not contain access_token: " + responseBody, output);
                }
                
            } else if ("API_KEY".equalsIgnoreCase(authType)) {
                String keyName = VariableInterpolator.resolve((String) config.get("keyName"), context);
                String keyValue = VariableInterpolator.resolve((String) config.get("keyValue"), context);
                if (keyName == null || keyName.isBlank() || keyValue == null || keyValue.isBlank()) {
                    return StepResult.failed("Key Name and Key Value are required for API Key Auth", output);
                }
                tokenValue = keyValue;
                expiresInSeconds = 86400;
                output.put("message", "Stored API Key in variable " + targetVariable);
            } else {
                return StepResult.failed("Unsupported auth type: " + authType, output);
            }

            long expiresAt = System.currentTimeMillis() + (expiresInSeconds * 1000L);
            output.put("expiresAt", expiresAt);

            List<StepResult.ExtractedVariable> extractedVars = List.of(
                new StepResult.ExtractedVariable(targetVariable, tokenValue),
                new StepResult.ExtractedVariable(targetVariable + "_expiresAt", String.valueOf(expiresAt)),
                new StepResult.ExtractedVariable("__auth_config_" + targetVariable, VariableInterpolator.toJson(config))
            );

            return StepResult.withVariables(extractedVars, output);
        } catch (Exception e) {
            log.error("Auth Token step execution failed: {}", e.getMessage(), e);
            return StepResult.failed("Failed to generate/fetch auth token: " + e.getMessage(), output);
        }
    }

    private RestClient buildRestClient() {
        if (orionSslContextFactory == null) {
            return RestClient.builder().build();
        }
        SSLContext sslContext = orionSslContextFactory.getOrionSslContext();
        HttpClient.Builder builder = HttpClient.newBuilder()
                .sslContext(sslContext)
                .followRedirects(HttpClient.Redirect.NORMAL);

        if (systemSettingsService != null && systemSettingsService.getBoolean("proxy.enabled", false)) {
            String proxyHost     = systemSettingsService.getString("proxy.host", "");
            int    proxyPort     = systemSettingsService.getInt("proxy.port", 8080);
            String proxyType     = systemSettingsService.getString("proxy.type", "HTTP");
            String nonProxyHosts = systemSettingsService.getString("proxy.nonProxyHosts", "");
            String proxyUsername = systemSettingsService.getString("proxy.username", "");
            String proxyPassword = systemSettingsService.getString("proxy.password", "");

            if (!proxyHost.isBlank()) {
                builder.proxy(com.axon.orion.common.util.ProxyUtils.createProxySelector(proxyHost, proxyPort, proxyType, nonProxyHosts));
                if (!proxyUsername.isBlank()) {
                    builder.authenticator(new Authenticator() {
                        @Override
                        protected PasswordAuthentication getPasswordAuthentication() {
                            if (getRequestorType() == Authenticator.RequestorType.PROXY) {
                                return new PasswordAuthentication(proxyUsername, proxyPassword.toCharArray());
                            }
                            return null;
                        }
                    });
                }
            }
        }

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(builder.build());
        return RestClient.builder().requestFactory(factory).build();
    }

    private ProxySelector createProxySelector(String host, int port, String type, String nonProxyHosts) {
        Proxy.Type proxyType = "SOCKS5".equalsIgnoreCase(type) || "SOCKS".equalsIgnoreCase(type)
                ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
        Proxy proxy = new Proxy(proxyType, new InetSocketAddress(host, port));
        List<String> bypassPatterns = nonProxyHosts.isBlank()
                ? List.of()
                : Arrays.stream(nonProxyHosts.split("[,;|]")).map(String::trim).toList();

        return new ProxySelector() {
            @Override
            public List<Proxy> select(URI uri) {
                String uriHost = uri.getHost();
                if (uriHost != null && !bypassPatterns.isEmpty()) {
                    for (String pattern : bypassPatterns) {
                        if (pattern.startsWith("*") && uriHost.endsWith(pattern.substring(1))) {
                            return List.of(Proxy.NO_PROXY);
                        } else if (uriHost.equalsIgnoreCase(pattern)) {
                            return List.of(Proxy.NO_PROXY);
                        }
                    }
                }
                return List.of(proxy);
            }

            @Override
            public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
                log.error("Proxy connection failed for URI {}: {}", uri, ioe.getMessage());
            }
        };
    }
}
