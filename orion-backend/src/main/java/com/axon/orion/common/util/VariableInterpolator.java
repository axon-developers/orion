package com.axon.orion.common.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves {{variableName}} placeholders in strings and JSON objects
 * using a provided variable context map.
 */
@Slf4j
public class VariableInterpolator {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{([^}]+)}}");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private VariableInterpolator() {
        // Utility class — no instantiation
    }

    /**
     * Resolves all {{variableName}} placeholders in a string.
     *
     * @param template the string template with placeholders
     * @param context  map of variable names to values
     * @return resolved string with all matched placeholders replaced
     */
    public static String resolve(String template, Map<String, String> context) {
        if (template == null || template.isBlank()) {
            return template;
        }
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1).trim();
            String value = context.getOrDefault(varName, matcher.group(0)); // keep original if not found
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * Resolves all {{variableName}} placeholders within a JSON string.
     * Works by converting to string, resolving, and returning the resolved JSON string.
     *
     * @param json    the JSON string to resolve
     * @param context map of variable names to values
     * @return resolved JSON string
     */
    public static String resolveJson(String json, Map<String, String> context) {
        if (json == null || json.isBlank()) {
            return json;
        }
        return resolve(json, context);
    }

    /**
     * Resolves all {{variableName}} placeholders in a Map (shallow key-value resolution).
     *
     * @param map     map of key to template values
     * @param context variable context
     * @return new map with all values resolved
     */
    public static Map<String, String> resolveMap(Map<String, String> map, Map<String, String> context) {
        if (map == null) return Map.of();
        return map.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        e -> resolve(e.getValue(), context)
                ));
    }

    /**
     * Extracts all variable names referenced in a template string.
     *
     * @param template the template string
     * @return set of variable names found
     */
    public static java.util.Set<String> extractVariableNames(String template) {
        if (template == null) return java.util.Set.of();
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        java.util.Set<String> names = new java.util.LinkedHashSet<>();
        while (matcher.find()) {
            names.add(matcher.group(1).trim());
        }
        return names;
    }

    /**
     * Converts a JSON string config to a Map for further resolution.
     */
    public static Map<String, Object> parseConfig(String configJson) {
        try {
            return OBJECT_MAPPER.readValue(configJson, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse config JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * Converts a config map back to JSON string.
     */
    public static String toJson(Object obj) {
        try {
            return OBJECT_MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            log.warn("Failed to serialize to JSON: {}", e.getMessage());
            return "{}";
        }
    }
}
