package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class SetVariableExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.SET_VARIABLE);
    }

    @SuppressWarnings("unchecked")
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        List<Map<String, Object>> variables = (List<Map<String, Object>>) config.get("variables");

        if (variables == null || variables.isEmpty()) {
            // Support legacy format
            variables = List.of(config);
        }

        Map<String, Object> outputPayload = new HashMap<>();
        List<StepResult.ExtractedVariable> extractedVariables = new ArrayList<>();

        for (Map<String, Object> varConfig : variables) {
            String variableName = (String) varConfig.get("variableName");
            if (variableName == null || variableName.isBlank()) continue;

            String source = (String) varConfig.getOrDefault("source", "RESPONSE_BODY");
            String jsonPath = (String) varConfig.get("jsonPath");
            String xpath = (String) varConfig.get("xPath");
            String headerName = (String) varConfig.get("headerName");

            String extractedValue = switch (source) {
                case "RESPONSE_BODY" -> {
                    String body = context.getOrDefault("__lastResponseBody", "");
                    if (xpath != null && !xpath.isBlank()) {
                        yield extractXPath(body, xpath);
                    } else if (jsonPath != null && !jsonPath.isBlank()) {
                        yield extractJsonPath(body, jsonPath);
                    }
                    yield body;
                }
                case "RESPONSE_HEADER" -> context.getOrDefault("__lastHeader_" + headerName, "");
                default -> context.getOrDefault(variableName, "");
            };

            extractedVariables.add(new StepResult.ExtractedVariable(variableName, extractedValue));
            outputPayload.put(variableName, Map.of("value", extractedValue, "source", source));
        }

        if (extractedVariables.isEmpty()) {
            return StepResult.failed("No valid variables to extract. 'variableName' is required for each variable config.", outputPayload);
        }

        return StepResult.withVariables(extractedVariables, outputPayload);
    }

    private String extractJsonPath(String json, String path) {
        try {
            Object value = JsonPath.read(json, path);
            return value != null ? value.toString() : "";
        } catch (PathNotFoundException e) {
            return "";
        } catch (Exception e) {
            log.warn("JSONPath extraction failed: {}", e.getMessage());
            return "";
        }
    }

    private String extractXPath(String xml, String xpathExpression) {
        if (xml == null || xml.isBlank() || xpathExpression == null || xpathExpression.isBlank()) {
            return "";
        }
        try {
            org.xml.sax.InputSource inputSource = new org.xml.sax.InputSource(new java.io.StringReader(xml));
            javax.xml.xpath.XPathFactory xpathFactory = javax.xml.xpath.XPathFactory.newInstance();
            try {
                xpathFactory.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            } catch (Exception ex) {
                log.warn("Failed to set secure processing feature on XPathFactory: {}", ex.getMessage());
            }
            javax.xml.xpath.XPath xpath = xpathFactory.newXPath();
            return xpath.evaluate(xpathExpression, inputSource);
        } catch (Exception e) {
            log.warn("XPath extraction failed for expression '{}': {}", xpathExpression, e.getMessage());
            return "";
        }
    }
}
