package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Component
public class AssertionExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.ASSERTION);
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String source = (String) config.getOrDefault("source", "RESPONSE_BODY");
        String operator = (String) config.getOrDefault("operator", "EQUALS");
        String expectedValue = VariableInterpolator.resolve((String) config.get("expectedValue"), context);
        String message = (String) config.getOrDefault("message", "Assertion failed");

        String actualValue = extractActualValue(source, config, context);

        boolean passed = evaluate(operator, actualValue, expectedValue);

        Map<String, Object> output = Map.of(
                "source", source,
                "operator", operator,
                "expected", expectedValue != null ? expectedValue : "",
                "actual", actualValue != null ? actualValue : ""
        );

        if (passed) {
            return StepResult.passed(output);
        } else {
            String errorMsg = String.format("%s — expected: '%s', actual: '%s'",
                    message, expectedValue, actualValue);
            return StepResult.failed(errorMsg, output);
        }
    }

    private String extractActualValue(String source, Map<String, Object> config, Map<String, String> context) {
        String baseVal = switch (source) {
            case "STATUS_CODE" -> context.getOrDefault("__lastStatusCode", "");
            case "RESPONSE_TIME" -> context.getOrDefault("__lastResponseTimeMs", "0");
            case "RESPONSE_HEADER" -> {
                String headerName = (String) config.get("headerName");
                yield headerName != null ? context.getOrDefault("__lastHeader_" + headerName, "") : "";
            }
            case "VARIABLE" -> {
                String varName = (String) config.get("variableName");
                yield varName != null ? context.getOrDefault(varName, "") : "";
            }
            default -> { // RESPONSE_BODY
                String body = context.getOrDefault("__lastResponseBody", "");
                String jsonPath = (String) config.get("jsonPath");
                String xpath = (String) config.get("xPath");
                if (xpath != null && !xpath.isBlank()) {
                    yield extractXPath(body, xpath);
                } else if (jsonPath != null && !jsonPath.isBlank()) {
                    yield extractJsonPath(body, jsonPath);
                }
                yield body;
            }
        };

        String operator = (String) config.getOrDefault("operator", "EQUALS");
        if ("FIELD_COUNT".equalsIgnoreCase(operator)) {
            return getFieldCount(baseVal);
        }
        return baseVal;
    }

    private String getFieldCount(String json) {
        if (json == null || json.isBlank()) return "0";
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(json);
            if (node.isArray() || node.isObject()) {
                return String.valueOf(node.size());
            }
            return "1"; // single scalar value is size 1
        } catch (Exception e) {
            return "0";
        }
    }

    private String extractJsonPath(String json, String path) {
        try {
            Object value = JsonPath.read(json, path);
            return value != null ? value.toString() : "";
        } catch (PathNotFoundException e) {
            return "";
        } catch (Exception e) {
            log.warn("JSONPath extraction failed for path '{}': {}", path, e.getMessage());
            return "";
        }
    }

    private boolean evaluate(String operator, String actual, String expected) {
        if (actual == null) actual = "";
        if (expected == null) expected = "";
        return switch (operator) {
            case "EQUALS", "STATUS_CODE" -> actual.equals(expected);
            case "NOT_EQUALS" -> !actual.equals(expected);
            case "CONTAINS" -> actual.contains(expected);
            case "GREATER_THAN" -> {
                try { yield Double.parseDouble(actual) > Double.parseDouble(expected); }
                catch (NumberFormatException e) { yield false; }
            }
            case "LESS_THAN" -> {
                try { yield Double.parseDouble(actual) < Double.parseDouble(expected); }
                catch (NumberFormatException e) { yield false; }
            }
            case "REGEX_MATCH" -> {
                try { yield Pattern.compile(expected).matcher(actual).find(); }
                catch (Exception e) { yield false; }
            }
            case "JSON_SCHEMA_VALIDATION" -> validateJsonSchema(actual, expected);
            case "ARRAY_CONTAINS" -> arrayContains(actual, expected);
            case "FIELD_COUNT" -> {
                try {
                    yield Integer.parseInt(actual) == Integer.parseInt(expected);
                } catch (NumberFormatException e) {
                    yield false;
                }
            }
            default -> actual.equals(expected);
        };
    }

    private boolean validateJsonSchema(String json, String schemaStr) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode schemaNode = mapper.readTree(schemaStr);
            com.fasterxml.jackson.databind.JsonNode actualNode = mapper.readTree(json);
            
            com.networknt.schema.JsonSchemaFactory factory = com.networknt.schema.JsonSchemaFactory.getInstance(com.networknt.schema.SpecVersion.VersionFlag.V7);
            com.networknt.schema.JsonSchema schema = factory.getSchema(schemaNode);
            
            Set<com.networknt.schema.ValidationMessage> errors = schema.validate(actualNode);
            if (errors.isEmpty()) {
                return true;
            } else {
                log.warn("JSON Schema validation failed: {}", errors);
                return false;
            }
        } catch (Exception e) {
            log.warn("Error validating JSON Schema: {}", e.getMessage());
            return false;
        }
    }

    private boolean arrayContains(String jsonArray, String expectedElement) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(jsonArray);
            if (node.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode element : node) {
                    if (element.asText().equals(expectedElement) || element.toString().equals(expectedElement)) {
                        return true;
                    }
                }
            }
            return jsonArray.contains(expectedElement);
        } catch (Exception e) {
            return jsonArray.contains(expectedElement);
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
