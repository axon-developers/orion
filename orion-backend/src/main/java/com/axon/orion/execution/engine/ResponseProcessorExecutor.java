package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Executor for RESPONSE_PROCESSOR step type.
 *
 * Reads the last HTTP/SOAP response body (or a named variable), applies a
 * configurable extraction and slicing pipeline, optionally asserts on the
 * result, and stores it as a named variable for downstream steps.
 *
 * Config fields:
 *  sourceType        – "RESPONSE_BODY" | "VARIABLE"
 *  sourceVariable    – variable name when sourceType=VARIABLE
 *  payloadFormat     – "JSON" | "XML" | "TEXT"
 *  jsonPath          – JSONPath expression (when payloadFormat=JSON)
 *  xPath             – XPath expression (when payloadFormat=XML)
 *  startFindText     – slice output starting from this string
 *  endFindText       – slice output ending at this string (inclusive)
 *  maxLines          – maximum number of output lines (0 = unlimited)
 *  maxObjects        – maximum array items (0 = unlimited, JSON arrays only)
 *  assertMode        – "NONE" | "CONTAINS" | "EQUALS" | "NOT_CONTAINS" | "REGEX"
 *  expectedValue     – value to check against extracted result
 *  targetVariable    – execution context variable name to save result into
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ResponseProcessorExecutor implements StepExecutor {

    private final ObjectMapper objectMapper;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.RESPONSE_PROCESSOR);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {

        // ── 1. Resolve source ────────────────────────────────────────────────
        String sourceType = (String) config.getOrDefault("sourceType", "RESPONSE_BODY");
        String raw;
        if ("VARIABLE".equals(sourceType)) {
            String varName = VariableInterpolator.resolve((String) config.get("sourceVariable"), context);
            raw = context.getOrDefault(varName, "");
            if (raw.isBlank()) {
                return StepResult.failed("Source variable '" + varName + "' is empty or not set in the execution context.", Map.of());
            }
        } else {
            raw = context.getOrDefault("__lastResponseBody", "");
            if (raw == null || raw.isBlank()) {
                return StepResult.failed(
                    "No response body found in execution context. " +
                    "Place an HTTP Request or SOAP Request step before this Response Recorder step.", Map.of());
            }
        }

        int originalLength = raw.length();

        // ── 2. Extract via JSONPath / XPath ──────────────────────────────────
        String payloadFormat = (String) config.getOrDefault("payloadFormat", "JSON");
        String jsonPath = VariableInterpolator.resolve((String) config.get("jsonPath"), context);
        String xPath    = VariableInterpolator.resolve((String) config.get("xPath"), context);
        String extracted = raw;

        if ("JSON".equals(payloadFormat) && jsonPath != null && !jsonPath.isBlank()) {
            try {
                Object val = JsonPath.read(raw, jsonPath);
                if (val instanceof Map || val instanceof List) {
                    extracted = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(val);
                } else {
                    extracted = val != null ? val.toString() : "";
                }
            } catch (PathNotFoundException e) {
                return StepResult.failed(
                    "JSONPath '" + jsonPath + "' did not match any element in the response body.",
                    Map.of("jsonPath", jsonPath, "bodyPreview", truncate(raw, 300)));
            } catch (Exception e) {
                return StepResult.failed("JSONPath extraction error: " + e.getMessage(),
                    Map.of("jsonPath", jsonPath));
            }
        } else if ("XML".equals(payloadFormat) && xPath != null && !xPath.isBlank()) {
            try {
                extracted = extractXPath(raw, xPath);
            } catch (Exception e) {
                return StepResult.failed("XPath extraction error: " + e.getMessage(),
                    Map.of("xPath", xPath));
            }
        }
        // TEXT: use raw body as-is

        // ── 3. Text-range slicing ────────────────────────────────────────────
        String startFindText = VariableInterpolator.resolve((String) config.get("startFindText"), context);
        String endFindText   = VariableInterpolator.resolve((String) config.get("endFindText"), context);

        if (startFindText != null && !startFindText.isBlank()) {
            int idx = extracted.indexOf(startFindText);
            if (idx != -1) {
                extracted = extracted.substring(idx);
            }
        }
        if (endFindText != null && !endFindText.isBlank()) {
            int idx = extracted.indexOf(endFindText);
            if (idx != -1) {
                extracted = extracted.substring(0, idx + endFindText.length());
            }
        }

        // ── 4. Array object limit (JSON arrays only) ─────────────────────────
        int maxObjects = config.get("maxObjects") != null ? ((Number) config.get("maxObjects")).intValue() : 0;
        if (maxObjects > 0 && "JSON".equals(payloadFormat)) {
            try {
                Object parsed = objectMapper.readValue(extracted, Object.class);
                if (parsed instanceof List<?> list && list.size() > maxObjects) {
                    List<?> truncated = list.subList(0, maxObjects);
                    extracted = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(truncated)
                            + "\n// ... truncated to first " + maxObjects + " objects (total: " + list.size() + ")";
                }
            } catch (Exception e) {
                // Not a JSON array — skip silently
            }
        }

        // ── 5. Line limit ────────────────────────────────────────────────────
        int maxLines = config.get("maxLines") != null ? ((Number) config.get("maxLines")).intValue() : 0;
        int totalLines;
        String[] allLines = extracted.split("\\r?\\n", -1);
        totalLines = allLines.length;
        if (maxLines > 0 && allLines.length > maxLines) {
            extracted = Arrays.stream(allLines)
                    .limit(maxLines)
                    .collect(Collectors.joining("\n"))
                    + "\n// ... truncated to first " + maxLines + " lines (total: " + allLines.length + ")";
            totalLines = maxLines;
        }

        // ── 6. Save to context variable ──────────────────────────────────────
        String targetVariable = VariableInterpolator.resolve((String) config.get("targetVariable"), context);
        if (targetVariable != null && !targetVariable.isBlank()) {
            context.put(targetVariable, extracted);
        }

        // ── 7. Assertion ─────────────────────────────────────────────────────
        String assertMode    = (String) config.getOrDefault("assertMode", "NONE");
        String expectedValue = VariableInterpolator.resolve((String) config.get("expectedValue"), context);

        String assertResult = "SKIPPED";
        String assertMessage = null;

        if (!"NONE".equals(assertMode) && expectedValue != null && !expectedValue.isBlank()) {
            boolean passed = switch (assertMode) {
                case "CONTAINS"     -> extracted.contains(expectedValue);
                case "NOT_CONTAINS" -> !extracted.contains(expectedValue);
                case "EQUALS"       -> extracted.trim().equals(expectedValue.trim());
                case "REGEX"        -> {
                    try { yield Pattern.compile(expectedValue).matcher(extracted).find(); }
                    catch (Exception e) { yield false; }
                }
                default -> true;
            };
            assertResult = passed ? "PASSED" : "FAILED";
            if (!passed) {
                assertMessage = String.format(
                    "Assertion '%s' failed. Expected: [%s]. Extracted output (first 200 chars): [%s]",
                    assertMode, expectedValue, truncate(extracted, 200));
            }
        }

        // ── 8. Build output ──────────────────────────────────────────────────
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("recordedBody",     extracted);
        output.put("originalLength",   originalLength);
        output.put("extractedLength",  extracted.length());
        output.put("linesShown",       totalLines);
        output.put("assertMode",       assertMode);
        output.put("assertResult",     assertResult);
        if (expectedValue != null && !expectedValue.isBlank()) {
            output.put("expectedValue", expectedValue);
        }
        if (targetVariable != null && !targetVariable.isBlank()) {
            output.put("savedVariable", targetVariable);
        }
        if (assertMessage != null) {
            output.put("assertMessage", assertMessage);
        }

        if ("FAILED".equals(assertResult)) {
            return StepResult.failed(assertMessage, output);
        }
        return StepResult.passed(output);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }

    private String extractXPath(String xml, String xpathExpression) {
        if (xml == null || xml.isBlank() || xpathExpression == null || xpathExpression.isBlank()) return "";
        try {
            org.xml.sax.InputSource inputSource = new org.xml.sax.InputSource(new java.io.StringReader(xml));
            javax.xml.xpath.XPathFactory xpathFactory = javax.xml.xpath.XPathFactory.newInstance();
            try { xpathFactory.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true); }
            catch (Exception ex) { log.warn("XPathFactory secure processing: {}", ex.getMessage()); }
            javax.xml.xpath.XPath xpath = xpathFactory.newXPath();
            return xpath.evaluate(xpathExpression, inputSource);
        } catch (Exception e) {
            log.warn("XPath evaluation failed for '{}': {}", xpathExpression, e.getMessage());
            return "";
        }
    }
}
