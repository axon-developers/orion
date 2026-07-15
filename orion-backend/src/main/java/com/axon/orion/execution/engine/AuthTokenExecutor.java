package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthTokenExecutor implements StepExecutor {

    private final ObjectMapper objectMapper;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.AUTH_TOKEN);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String authType = (String) config.getOrDefault("authType", "BASIC");
        String targetVariable = (String) config.getOrDefault("targetVariable", "authToken");
        
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("authType", authType);
        output.put("targetVariable", targetVariable);

        try {
            if ("BASIC".equalsIgnoreCase(authType)) {
                String username = VariableInterpolator.resolve((String) config.get("username"), context);
                String password = VariableInterpolator.resolve((String) config.get("password"), context);
                if (username == null || password == null) {
                    return StepResult.failed("Username and Password are required for Basic Auth", output);
                }
                String base64 = Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
                String token = "Basic " + base64;
                output.put("message", "Generated Basic Auth token successfully");
                return StepResult.withVariable(targetVariable, token, output);
                
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

                RestClient client = RestClient.builder().build();
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
                    String fullToken = tokenType + " " + token;
                    output.put("token_type", tokenType);
                    output.put("expires_in", node.has("expires_in") ? node.get("expires_in").asInt() : null);
                    output.put("message", "Fetched OAuth2 access token successfully");
                    return StepResult.withVariable(targetVariable, fullToken, output);
                } else {
                    return StepResult.failed("OAuth2 response did not contain access_token: " + responseBody, output);
                }
                
            } else if ("API_KEY".equalsIgnoreCase(authType)) {
                String keyName = VariableInterpolator.resolve((String) config.get("keyName"), context);
                String keyValue = VariableInterpolator.resolve((String) config.get("keyValue"), context);
                if (keyName == null || keyName.isBlank() || keyValue == null || keyValue.isBlank()) {
                    return StepResult.failed("Key Name and Key Value are required for API Key Auth", output);
                }
                output.put("message", "Stored API Key in variable " + targetVariable);
                return StepResult.withVariable(targetVariable, keyValue, output);
            } else {
                return StepResult.failed("Unsupported auth type: " + authType, output);
            }
        } catch (Exception e) {
            log.error("Auth Token step execution failed: {}", e.getMessage(), e);
            return StepResult.failed("Failed to generate/fetch auth token: " + e.getMessage(), output);
        }
    }
}
