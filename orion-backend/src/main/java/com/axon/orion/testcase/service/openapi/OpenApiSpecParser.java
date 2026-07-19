package com.axon.orion.testcase.service.openapi;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class OpenApiSpecParser {

    @SuppressWarnings("unchecked")
    public List<ParsedOperation> parse(Map<String, Object> spec) {
        List<ParsedOperation> operations = new ArrayList<>();
        if (spec == null || !spec.containsKey("paths")) {
            return operations;
        }

        Map<String, Object> componentsOrDefs = getComponentsOrDefinitions(spec);

        Object pathsObj = spec.get("paths");
        if (!(pathsObj instanceof Map)) {
            return operations;
        }

        Map<String, Object> paths = (Map<String, Object>) pathsObj;

        for (Map.Entry<String, Object> pathEntry : paths.entrySet()) {
            String rawPath = pathEntry.getKey();
            if (!(pathEntry.getValue() instanceof Map)) continue;

            Map<String, Object> pathOps = (Map<String, Object>) pathEntry.getValue();

            // Extract path-level parameters if present
            List<Map<String, Object>> pathLevelParams = new ArrayList<>();
            Object pathParamsObj = pathOps.get("parameters");
            if (pathParamsObj instanceof List) {
                for (Object item : (List<?>) pathParamsObj) {
                    if (item instanceof Map) {
                        pathLevelParams.add((Map<String, Object>) item);
                    }
                }
            }

            for (Map.Entry<String, Object> opEntry : pathOps.entrySet()) {
                String method = opEntry.getKey().toLowerCase();
                if (!List.of("get", "post", "put", "delete", "patch").contains(method)) {
                    continue;
                }
                if (!(opEntry.getValue() instanceof Map)) continue;

                Map<String, Object> opMap = (Map<String, Object>) opEntry.getValue();
                ParsedOperation op = parseOperation(rawPath, method, opMap, pathLevelParams, componentsOrDefs);
                operations.add(op);
            }
        }

        return operations;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getComponentsOrDefinitions(Map<String, Object> spec) {
        Map<String, Object> schemas = new HashMap<>();
        // OpenAPI 3.x
        Object componentsObj = spec.get("components");
        if (componentsObj instanceof Map) {
            Object schemasObj = ((Map<String, Object>) componentsObj).get("schemas");
            if (schemasObj instanceof Map) {
                schemas.putAll((Map<String, Object>) schemasObj);
            }
        }
        // Swagger 2.0
        Object defsObj = spec.get("definitions");
        if (defsObj instanceof Map) {
            schemas.putAll((Map<String, Object>) defsObj);
        }
        return schemas;
    }

    @SuppressWarnings("unchecked")
    private ParsedOperation parseOperation(
            String rawPath,
            String method,
            Map<String, Object> opMap,
            List<Map<String, Object>> pathLevelParams,
            Map<String, Object> schemas) {

        ParsedOperation op = new ParsedOperation();
        op.setRawPath(rawPath);
        op.setMethod(method.toUpperCase());

        // Convert /users/{id} to /users/{{id}}
        String resolvedPath = rawPath.replaceAll("\\{([^}]+)\\}", "{{$1}}");
        op.setResolvedPath(resolvedPath);

        op.setSummary((String) opMap.getOrDefault("summary", method.toUpperCase() + " " + rawPath));
        op.setDescription((String) opMap.get("description"));

        String opId = (String) opMap.get("operationId");
        if (opId == null || opId.isBlank()) {
            opId = method.toLowerCase() + rawPath.replaceAll("[^a-zA-Z0-9]", "_");
        }
        op.setOperationId(opId);

        // Tags
        Object tagsObj = opMap.get("tags");
        if (tagsObj instanceof List) {
            for (Object t : (List<?>) tagsObj) {
                if (t != null) op.getTags().add(t.toString());
            }
        }
        if (op.getTags().isEmpty()) {
            op.getTags().add("Untagged");
        }

        // Combine path-level and operation-level params
        List<Map<String, Object>> allParams = new ArrayList<>(pathLevelParams);
        Object opParamsObj = opMap.get("parameters");
        if (opParamsObj instanceof List) {
            for (Object item : (List<?>) opParamsObj) {
                if (item instanceof Map) {
                    allParams.add((Map<String, Object>) item);
                }
            }
        }

        // Parse Parameters (path, query, header, swagger v2 body/formData)
        for (Map<String, Object> paramMap : allParams) {
            paramMap = resolveRefIfNeeded(paramMap, schemas, new HashSet<>());
            String in = (String) paramMap.get("in");
            String name = (String) paramMap.get("name");
            if (name == null) continue;

            if ("path".equalsIgnoreCase(in)) {
                op.getPathParams().add(parseParam(paramMap, in, schemas));
            } else if ("query".equalsIgnoreCase(in)) {
                op.getQueryParams().add(parseParam(paramMap, in, schemas));
            } else if ("header".equalsIgnoreCase(in)) {
                op.getHeaderParams().add(parseParam(paramMap, in, schemas));
            } else if ("body".equalsIgnoreCase(in)) {
                // Swagger v2 body parameter
                op.setHasBody(true);
                op.setBodyContentType("application/json");
                Object schemaObj = paramMap.get("schema");
                if (schemaObj instanceof Map) {
                    Map<String, Object> schema = resolveRefIfNeeded((Map<String, Object>) schemaObj, schemas, new HashSet<>());
                    op.getBodyFields().addAll(extractFieldsFromSchema("", schema, schemas, new HashSet<>()));
                }
            } else if ("formData".equalsIgnoreCase(in)) {
                // Swagger v2 formData parameter
                op.setHasBody(true);
                op.setBodyContentType("multipart/form-data");
                op.setMultipart(true);

                ParsedBodyField field = new ParsedBodyField();
                field.setName(name);
                field.setType((String) paramMap.getOrDefault("type", "string"));
                field.setRequired(Boolean.TRUE.equals(paramMap.get("required")));
                field.setFormat((String) paramMap.get("format"));
                extractEnumValues(paramMap, field.getEnumValues());
                op.getBodyFields().add(field);
            }
        }

        // Parse OpenAPI v3 requestBody
        Object reqBodyObj = opMap.get("requestBody");
        if (reqBodyObj instanceof Map) {
            Map<String, Object> reqBody = resolveRefIfNeeded((Map<String, Object>) reqBodyObj, schemas, new HashSet<>());
            Object contentObj = reqBody.get("content");
            if (contentObj instanceof Map) {
                Map<String, Object> content = (Map<String, Object>) contentObj;

                if (content.containsKey("multipart/form-data")) {
                    op.setHasBody(true);
                    op.setBodyContentType("multipart/form-data");
                    op.setMultipart(true);
                    extractBodyFromContent((Map<String, Object>) content.get("multipart/form-data"), op, schemas);
                } else if (content.containsKey("application/json")) {
                    op.setHasBody(true);
                    op.setBodyContentType("application/json");
                    extractBodyFromContent((Map<String, Object>) content.get("application/json"), op, schemas);
                } else if (!content.isEmpty()) {
                    // Fallback to first available content type
                    Map.Entry<String, Object> firstEntry = content.entrySet().iterator().next();
                    op.setHasBody(true);
                    op.setBodyContentType(firstEntry.getKey());
                    if (firstEntry.getKey().contains("form-data") || firstEntry.getKey().contains("form-urlencoded")) {
                        op.setMultipart(true);
                    }
                    if (firstEntry.getValue() instanceof Map) {
                        extractBodyFromContent((Map<String, Object>) firstEntry.getValue(), op, schemas);
                    }
                }
            }
        }

        return op;
    }

    @SuppressWarnings("unchecked")
    private void extractBodyFromContent(Map<String, Object> mediaTypeObj, ParsedOperation op, Map<String, Object> schemas) {
        Object schemaObj = mediaTypeObj.get("schema");
        if (schemaObj instanceof Map) {
            Map<String, Object> schema = resolveRefIfNeeded((Map<String, Object>) schemaObj, schemas, new HashSet<>());
            op.getBodyFields().addAll(extractFieldsFromSchema("", schema, schemas, new HashSet<>()));
        }
    }

    @SuppressWarnings("unchecked")
    private ParsedParam parseParam(Map<String, Object> paramMap, String in, Map<String, Object> schemas) {
        ParsedParam param = new ParsedParam();
        param.setName((String) paramMap.get("name"));
        param.setIn(in);
        param.setRequired(Boolean.TRUE.equals(paramMap.get("required")) || "path".equalsIgnoreCase(in));
        param.setExampleValue(paramMap.get("example"));
        param.setDefaultValue(paramMap.get("default"));

        // OpenAPI v3 might nest schema under 'schema'
        Map<String, Object> schemaMap = paramMap;
        if (paramMap.containsKey("schema") && paramMap.get("schema") instanceof Map) {
            schemaMap = resolveRefIfNeeded((Map<String, Object>) paramMap.get("schema"), schemas, new HashSet<>());
        }

        param.setType((String) schemaMap.getOrDefault("type", "string"));
        param.setFormat((String) schemaMap.get("format"));
        extractEnumValues(schemaMap, param.getEnumValues());

        return param;
    }

    @SuppressWarnings("unchecked")
    private List<ParsedBodyField> extractFieldsFromSchema(
            String prefix,
            Map<String, Object> schema,
            Map<String, Object> schemas,
            Set<String> seenRefs) {

        List<ParsedBodyField> fields = new ArrayList<>();
        schema = resolveRefIfNeeded(schema, schemas, seenRefs);

        Object propertiesObj = schema.get("properties");
        List<String> requiredList = getRequiredList(schema);

        if (propertiesObj instanceof Map) {
            Map<String, Object> properties = (Map<String, Object>) propertiesObj;
            for (Map.Entry<String, Object> entry : properties.entrySet()) {
                String key = entry.getKey();
                String fieldName = prefix.isEmpty() ? key : prefix + "_" + key;

                if (!(entry.getValue() instanceof Map)) continue;
                Map<String, Object> propSchema = resolveRefIfNeeded((Map<String, Object>) entry.getValue(), schemas, new HashSet<>(seenRefs));

                String type = (String) propSchema.getOrDefault("type", "string");
                boolean required = requiredList.contains(key);

                ParsedBodyField field = new ParsedBodyField();
                field.setName(fieldName);
                field.setType(type);
                field.setRequired(required);
                field.setFormat((String) propSchema.get("format"));
                field.setExampleValue(propSchema.get("example"));
                field.setDefaultValue(propSchema.get("default"));
                extractEnumValues(propSchema, field.getEnumValues());

                if ("object".equalsIgnoreCase(type) && propSchema.containsKey("properties")) {
                    field.getNestedFields().addAll(extractFieldsFromSchema(fieldName, propSchema, schemas, seenRefs));
                    fields.add(field);
                } else if ("array".equalsIgnoreCase(type)) {
                    // Array field
                    fields.add(field);
                } else {
                    fields.add(field);
                }
            }
        } else if ("object".equalsIgnoreCase((String) schema.get("type"))) {
            // Raw object without properties specified
            ParsedBodyField field = new ParsedBodyField();
            field.setName(prefix.isEmpty() ? "body" : prefix);
            field.setType("object");
            fields.add(field);
        }

        return fields;
    }

    @SuppressWarnings("unchecked")
    private List<String> getRequiredList(Map<String, Object> schema) {
        List<String> reqs = new ArrayList<>();
        Object reqObj = schema.get("required");
        if (reqObj instanceof List) {
            for (Object r : (List<?>) reqObj) {
                if (r != null) reqs.add(r.toString());
            }
        }
        return reqs;
    }

    @SuppressWarnings("unchecked")
    private void extractEnumValues(Map<String, Object> schemaMap, List<String> targetList) {
        Object enumObj = schemaMap.get("enum");
        if (enumObj instanceof List) {
            for (Object val : (List<?>) enumObj) {
                if (val != null) {
                    targetList.add(val.toString());
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveRefIfNeeded(Map<String, Object> obj, Map<String, Object> schemas, Set<String> seenRefs) {
        if (obj == null || !obj.containsKey("$ref")) {
            return obj != null ? obj : Map.of();
        }

        String refStr = (String) obj.get("$ref");
        if (refStr == null || seenRefs.contains(refStr)) {
            return obj; // Cycle detected or null ref
        }

        seenRefs.add(refStr);
        String schemaName = refStr.substring(refStr.lastIndexOf('/') + 1);

        Object refObj = schemas.get(schemaName);
        if (refObj instanceof Map) {
            Map<String, Object> resolved = new HashMap<>((Map<String, Object>) refObj);
            // Merge overlay attributes if present in caller map
            for (Map.Entry<String, Object> entry : obj.entrySet()) {
                if (!"$ref".equals(entry.getKey())) {
                    resolved.put(entry.getKey(), entry.getValue());
                }
            }
            return resolveRefIfNeeded(resolved, schemas, seenRefs);
        }

        return obj;
    }
}
