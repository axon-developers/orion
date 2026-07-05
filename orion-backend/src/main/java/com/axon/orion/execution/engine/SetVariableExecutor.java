package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class SetVariableExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.SET_VARIABLE);
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String variableName = (String) config.get("variableName");
        String source = (String) config.getOrDefault("source", "RESPONSE_BODY");
        String jsonPath = (String) config.get("jsonPath");
        String xpath = (String) config.get("xPath");
        String headerName = (String) config.get("headerName");

        if (variableName == null || variableName.isBlank()) {
            return StepResult.failed("variableName is required for SET_VARIABLE step", Map.of());
        }

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
            case "RESPONSE_HEADER" -> context.getOrDefault(
                    "__lastHeader_" + headerName, "");
            default -> context.getOrDefault(variableName, "");
        };

        return StepResult.withVariable(variableName, extractedValue, Map.of(
                "variableName", variableName,
                "value", extractedValue,
                "source", source
        ));
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
