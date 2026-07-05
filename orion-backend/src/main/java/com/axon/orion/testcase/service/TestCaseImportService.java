package com.axon.orion.testcase.service;

import com.axon.orion.testcase.dto.TestCaseDtos;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestCaseImportService {

    private final TestStepService testStepService;
    private final ObjectMapper objectMapper;

    public List<TestCaseDtos.TestStepDto> importCollection(String tcId, MultipartFile file, String type) {
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            Map<String, Object> data = objectMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
            
            List<TestCaseDtos.CreateTestStepRequest> requests = new ArrayList<>();

            if ("POSTMAN".equalsIgnoreCase(type)) {
                parsePostmanCollection(data, requests);
            } else if ("OPENAPI".equalsIgnoreCase(type)) {
                parseOpenApiSpec(data, requests);
            } else {
                throw new IllegalArgumentException("Unsupported import type: " + type);
            }

            List<TestCaseDtos.TestStepDto> importedSteps = new ArrayList<>();
            for (TestCaseDtos.CreateTestStepRequest req : requests) {
                importedSteps.add(testStepService.addStep(tcId, req));
            }
            return importedSteps;

        } catch (IOException e) {
            log.error("Failed to parse collection import file: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to read file contents: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private void parsePostmanCollection(Map<String, Object> data, List<TestCaseDtos.CreateTestStepRequest> requests) {
        Object itemObj = data.get("item");
        if (itemObj instanceof List) {
            parsePostmanItems((List<Object>) itemObj, requests);
        }
    }

    @SuppressWarnings("unchecked")
    private void parsePostmanItems(List<Object> items, List<TestCaseDtos.CreateTestStepRequest> requests) {
        for (Object itemObj : items) {
            if (!(itemObj instanceof Map)) continue;
            Map<String, Object> item = (Map<String, Object>) itemObj;

            if (item.containsKey("item")) {
                // It's a folder, traverse nested requests
                parsePostmanItems((List<Object>) item.get("item"), requests);
            } else if (item.containsKey("request")) {
                // It's a request
                parsePostmanRequest(item, requests);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void parsePostmanRequest(Map<String, Object> item, List<TestCaseDtos.CreateTestStepRequest> requests) {
        String name = (String) item.getOrDefault("name", "Imported Postman Request");
        Object reqObj = item.get("request");
        if (!(reqObj instanceof Map)) return;
        Map<String, Object> reqMap = (Map<String, Object>) reqObj;

        String method = (String) reqMap.getOrDefault("method", "GET");
        
        // Parse URL
        String urlStr = "";
        Object urlObj = reqMap.get("url");
        if (urlObj instanceof Map) {
            urlStr = (String) ((Map<String, Object>) urlObj).getOrDefault("raw", "");
        } else if (urlObj instanceof String) {
            urlStr = (String) urlObj;
        }

        // Parse Headers
        Map<String, String> headers = new LinkedHashMap<>();
        Object headerObj = reqMap.get("header");
        if (headerObj instanceof List) {
            for (Object h : (List<Object>) headerObj) {
                if (h instanceof Map) {
                    Map<String, Object> hMap = (Map<String, Object>) h;
                    String key = (String) hMap.get("key");
                    String value = (String) hMap.get("value");
                    if (key != null && !key.isBlank()) {
                        headers.put(key, value != null ? value : "");
                    }
                }
            }
        }

        // Parse Body
        String bodyType = "NONE";
        String bodyContent = "";
        Object bodyObj = reqMap.get("body");
        if (bodyObj instanceof Map) {
            Map<String, Object> bodyMap = (Map<String, Object>) bodyObj;
            String mode = (String) bodyMap.get("mode");
            if ("raw".equalsIgnoreCase(mode)) {
                bodyContent = (String) bodyMap.getOrDefault("raw", "");
                bodyType = "JSON"; // Default mode-raw body to JSON context
            }
        }

        // Assemble HTTP Step config
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("method", method.toUpperCase());
        config.put("url", urlStr);
        config.put("headers", headers);
        config.put("bodyType", bodyType);
        config.put("body", bodyContent);
        config.put("timeoutMs", 30000);

        TestCaseDtos.CreateTestStepRequest stepReq = new TestCaseDtos.CreateTestStepRequest();
        stepReq.setName(name);
        stepReq.setDescription("Imported from Postman Collection");
        stepReq.setStepType(TestStep.StepType.HTTP_REQUEST);
        stepReq.setActionType(TestStep.ActionType.NONE);
        stepReq.setConfig(config);
        stepReq.setEnabled(true);

        requests.add(stepReq);
    }

    @SuppressWarnings("unchecked")
    private void parseOpenApiSpec(Map<String, Object> data, List<TestCaseDtos.CreateTestStepRequest> requests) {
        Object pathsObj = data.get("paths");
        if (!(pathsObj instanceof Map)) return;
        Map<String, Object> paths = (Map<String, Object>) pathsObj;

        for (Map.Entry<String, Object> pathEntry : paths.entrySet()) {
            String path = pathEntry.getKey();
            if (!(pathEntry.getValue() instanceof Map)) continue;
            Map<String, Object> pathOps = (Map<String, Object>) pathEntry.getValue();

            for (Map.Entry<String, Object> opEntry : pathOps.entrySet()) {
                String method = opEntry.getKey();
                if (!(opEntry.getValue() instanceof Map)) continue;
                Map<String, Object> operation = (Map<String, Object>) opEntry.getValue();

                String summary = (String) operation.get("summary");
                String description = (String) operation.get("description");
                String name = summary != null && !summary.isBlank() ? summary : (method.toUpperCase() + " " + path);

                Map<String, String> headers = new LinkedHashMap<>();
                headers.put("Content-Type", "application/json");

                String bodyType = "NONE";
                String bodyContent = "";

                // Check requestBody
                Object bodyObj = operation.get("requestBody");
                if (bodyObj instanceof Map) {
                    Map<String, Object> bodyMap = (Map<String, Object>) bodyObj;
                    Object contentObj = bodyMap.get("content");
                    if (contentObj instanceof Map) {
                        Map<String, Object> contentMap = (Map<String, Object>) contentObj;
                        if (contentMap.containsKey("application/json")) {
                            bodyType = "JSON";
                            bodyContent = "{}"; // Default json placeholder
                        }
                    }
                }

                Map<String, Object> config = new LinkedHashMap<>();
                config.put("method", method.toUpperCase());
                config.put("url", "{{baseUrl}}" + path);
                config.put("headers", headers);
                config.put("bodyType", bodyType);
                config.put("body", bodyContent);
                config.put("timeoutMs", 30000);

                TestCaseDtos.CreateTestStepRequest stepReq = new TestCaseDtos.CreateTestStepRequest();
                stepReq.setName(name);
                stepReq.setDescription(description != null ? description : "Imported from OpenAPI Spec");
                stepReq.setStepType(TestStep.StepType.HTTP_REQUEST);
                stepReq.setActionType(TestStep.ActionType.NONE);
                stepReq.setConfig(config);
                stepReq.setEnabled(true);

                requests.add(stepReq);
            }
        }
    }
}
