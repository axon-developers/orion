package com.axon.orion.testcase.service.openapi;

import com.axon.orion.testcase.dto.AdvancedGeneratorOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class UseCaseCartographer {

    public List<UseCaseRow> generateUseCases(ParsedOperation op, AdvancedGeneratorOptions options) {
        List<UseCaseRow> useCases = new ArrayList<>();
        int maxRows = options != null ? options.getMaxUseCasesPerOperation() : 20;
        if (maxRows <= 0) maxRows = 20;

        // 1. Collect all fields with enums
        List<FieldEnumMapping> enumFields = new ArrayList<>();
        for (ParsedParam p : op.getPathParams()) {
            if (!p.getEnumValues().isEmpty()) {
                enumFields.add(new FieldEnumMapping(p.getName(), "path", p.getEnumValues()));
            }
        }
        for (ParsedParam p : op.getQueryParams()) {
            if (!p.getEnumValues().isEmpty()) {
                enumFields.add(new FieldEnumMapping(p.getName(), "query", p.getEnumValues()));
            }
        }
        for (ParsedBodyField f : op.getBodyFields()) {
            if (!f.getEnumValues().isEmpty()) {
                enumFields.add(new FieldEnumMapping(f.getName(), "body", f.getEnumValues()));
            }
        }

        // 2. Enum combinations (Cartesian Product)
        if (!enumFields.isEmpty()) {
            List<Map<String, String>> cartesianCombinations = buildCartesianProduct(enumFields, maxRows);
            for (Map<String, String> combination : cartesianCombinations) {
                StringBuilder nameBuilder = new StringBuilder();
                for (Map.Entry<String, String> entry : combination.entrySet()) {
                    if (nameBuilder.length() > 0) nameBuilder.append("_");
                    nameBuilder.append(entry.getKey()).append("_").append(entry.getValue());
                }

                UseCaseRow row = buildBaseRow(op, nameBuilder.toString(), "ENUM_VARIANT", "200", false);
                // Override enum values from combination
                row.getValues().putAll(combination);
                useCases.add(row);
            }
        } else {
            // No enum fields -> Base Case
            useCases.add(buildBaseRow(op, "base_case", "BASE", "200", false));
        }

        // 3. Required-only Case (if optional fields exist)
        if (options != null && options.isIncludeOptionalFields() && hasOptionalFields(op)) {
            if (useCases.size() < maxRows) {
                UseCaseRow reqOnlyRow = buildBaseRow(op, "required_only", "REQUIRED_ONLY", "200", false);
                // Blank out optional fields
                clearOptionalFields(op, reqOnlyRow.getValues());
                useCases.add(reqOnlyRow);
            }
        }

        // 4. Negative Test Cases (if enabled)
        if (options != null && options.isIncludeNegativeCases()) {
            List<String> requiredFieldNames = getRequiredFieldNames(op);
            for (String reqFieldName : requiredFieldNames) {
                if (useCases.size() >= maxRows) break;
                UseCaseRow negRow = buildBaseRow(op, "negative_missing_" + reqFieldName, "NEGATIVE", "400", true);
                negRow.getValues().put(reqFieldName, ""); // intentionally leave required field empty
                negRow.setNotes("Tests 4XX response when required field '" + reqFieldName + "' is omitted");
                useCases.add(negRow);
            }
        }

        return useCases;
    }

    private UseCaseRow buildBaseRow(ParsedOperation op, String name, String type, String statusCode, boolean isNegative) {
        UseCaseRow row = new UseCaseRow();
        row.setUsecaseName(name);
        row.setUsecaseType(type);
        row.setExpectedStatusCode(statusCode);
        row.setNegativeCase(isNegative);
        row.setSelected(true);

        // Always present fixed metadata columns
        row.getValues().put("usecase_name", name);
        row.getValues().put("expected_status_code", statusCode);

        // Path params
        for (ParsedParam p : op.getPathParams()) {
            row.getValues().put(p.getName(), getDefaultParamValue(p));
        }

        // Query params
        for (ParsedParam p : op.getQueryParams()) {
            row.getValues().put(p.getName(), getDefaultParamValue(p));
        }

        // Body fields
        for (ParsedBodyField f : op.getBodyFields()) {
            row.getValues().put(f.getName(), getDefaultBodyFieldValue(f));
        }

        return row;
    }

    private String getDefaultParamValue(ParsedParam p) {
        if (!p.getEnumValues().isEmpty()) {
            return p.getEnumValues().get(0);
        }
        if (p.getExampleValue() != null) return p.getExampleValue().toString();
        if (p.getDefaultValue() != null) return p.getDefaultValue().toString();
        return generateDefaultValue(p.getType(), p.getFormat(), p.getName());
    }

    private String getDefaultBodyFieldValue(ParsedBodyField f) {
        if (!f.getEnumValues().isEmpty()) {
            return f.getEnumValues().get(0);
        }
        if (f.getExampleValue() != null) return f.getExampleValue().toString();
        if (f.getDefaultValue() != null) return f.getDefaultValue().toString();
        return generateDefaultValue(f.getType(), f.getFormat(), f.getName());
    }

    private String generateDefaultValue(String type, String format, String name) {
        if ("integer".equalsIgnoreCase(type) || "number".equalsIgnoreCase(type)) {
            return "1";
        }
        if ("boolean".equalsIgnoreCase(type)) {
            return "true";
        }
        if ("array".equalsIgnoreCase(type)) {
            return "[]";
        }
        if ("object".equalsIgnoreCase(type)) {
            return "{}";
        }

        // String types with formats
        if (format != null) {
            if ("email".equalsIgnoreCase(format)) return "test@example.com";
            if ("uuid".equalsIgnoreCase(format)) return "00000000-0000-0000-0000-000000000001";
            if ("date".equalsIgnoreCase(format)) return "2025-01-01";
            if ("date-time".equalsIgnoreCase(format)) return "2025-01-01T00:00:00Z";
        }

        if (name != null && name.toLowerCase().contains("email")) return "test@example.com";
        if (name != null && name.toLowerCase().contains("id")) return "1";

        return "test_value";
    }

    private boolean hasOptionalFields(ParsedOperation op) {
        for (ParsedParam p : op.getQueryParams()) {
            if (!p.isRequired()) return true;
        }
        for (ParsedBodyField f : op.getBodyFields()) {
            if (!f.isRequired()) return true;
        }
        return false;
    }

    private void clearOptionalFields(ParsedOperation op, Map<String, String> values) {
        for (ParsedParam p : op.getQueryParams()) {
            if (!p.isRequired()) values.put(p.getName(), "");
        }
        for (ParsedBodyField f : op.getBodyFields()) {
            if (!f.isRequired()) values.put(f.getName(), "");
        }
    }

    private List<String> getRequiredFieldNames(ParsedOperation op) {
        List<String> list = new ArrayList<>();
        for (ParsedParam p : op.getQueryParams()) {
            if (p.isRequired()) list.add(p.getName());
        }
        for (ParsedBodyField f : op.getBodyFields()) {
            if (f.isRequired()) list.add(f.getName());
        }
        return list;
    }

    private List<Map<String, String>> buildCartesianProduct(List<FieldEnumMapping> fields, int maxRows) {
        List<Map<String, String>> results = new ArrayList<>();
        generateCartesianRecursive(fields, 0, new LinkedHashMap<>(), results, maxRows);
        return results;
    }

    private void generateCartesianRecursive(
            List<FieldEnumMapping> fields,
            int index,
            Map<String, String> current,
            List<Map<String, String>> results,
            int maxRows) {

        if (results.size() >= maxRows) return;

        if (index == fields.size()) {
            results.add(new LinkedHashMap<>(current));
            return;
        }

        FieldEnumMapping field = fields.get(index);
        for (String val : field.enumValues) {
            if (results.size() >= maxRows) break;
            current.put(field.fieldName, val);
            generateCartesianRecursive(fields, index + 1, current, results, maxRows);
        }
    }

    private static class FieldEnumMapping {
        String fieldName;
        String location;
        List<String> enumValues;

        FieldEnumMapping(String fieldName, String location, List<String> enumValues) {
            this.fieldName = fieldName;
            this.location = location;
            this.enumValues = enumValues;
        }
    }
}
