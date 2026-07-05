package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.*;

@Slf4j
@Component
public class SoapRequestExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.SOAP_REQUEST);
    }

    private final EnvironmentRepository environmentRepository;
    private final RestClient defaultRestClient;

    public SoapRequestExecutor(EnvironmentRepository environmentRepository) {
        this.environmentRepository = environmentRepository;
        this.defaultRestClient = RestClient.builder().build();
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String url = VariableInterpolator.resolve((String) config.get("url"), context);
        String soapAction = (String) config.get("soapAction");
        String envelope = VariableInterpolator.resolve((String) config.get("envelope"), context);
        int timeoutMs = ((Number) config.getOrDefault("timeoutMs", 30000)).intValue();

        Map<String, Object> inputPayload = new LinkedHashMap<>();
        inputPayload.put("url", url);
        inputPayload.put("soapAction", soapAction);
        inputPayload.put("envelope", envelope);

        try {
            RestClient.RequestBodySpec requestSpec = defaultRestClient.method(HttpMethod.POST)
                    .uri(url);

            // Add standard SOAP headers
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

            if (envelope != null) {
                requestSpec.body(envelope);
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
            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("statusCode", e.getStatusCode().value());
            errorOutput.put("headers", e.getResponseHeaders() != null ? e.getResponseHeaders().toSingleValueMap() : Map.of());
            errorOutput.put("body", e.getResponseBodyAsString());

            context.put("__lastStatusCode", String.valueOf(e.getStatusCode().value()));
            context.put("__lastResponseBody", e.getResponseBodyAsString());

            return StepResult.failed("SOAP request failed with status: " + e.getStatusCode().value() + " " + e.getStatusText(), errorOutput);
        } catch (Exception e) {
            log.error("SOAP execution error: {}", e.getMessage(), e);
            return StepResult.failed("SOAP request error: " + e.getMessage(), Map.of());
        }
    }
}
