package com.axon.orion.testcase.service;

import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.audit.service.AuditService;
import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.dto.TestCaseDtos;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final TestStepRepository testStepRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public PagedResponse<TestCaseDtos.TestCaseDto> listTestCases(
            String appId, int page, int size, String search,
            TestCase.Status status, TestCase.Priority priority, String sort) {
        validateAppExists(appId);
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"updatedAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<TestCase> tcPage = testCaseRepository.findByAppIdWithFilters(appId, search, status, priority, pageRequest);
        List<TestCaseDtos.TestCaseDto> dtos = tcPage.getContent().stream()
                .map(tc -> toDto(tc, false)).toList();
        return PagedResponse.of(dtos, page, size, tcPage.getTotalElements());
    }

    public TestCaseDtos.TestCaseDetailDto getTestCaseWithSteps(String appId, String tcId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        TestCaseDtos.TestCaseDetailDto dto = new TestCaseDtos.TestCaseDetailDto();
        copyToDto(tc, dto);
        dto.setSteps(testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId)
                .stream().map(this::toStepDto).toList());
        return dto;
    }

    @Transactional
    public TestCaseDtos.TestCaseDto createTestCase(
            String appId, TestCaseDtos.CreateTestCaseRequest request, String userId) {
        validateAppExists(appId);
        TestCase tc = new TestCase();
        tc.setAppId(appId);
        tc.setName(request.getName());
        tc.setDescription(request.getDescription());
        tc.setTags(VariableInterpolator.toJson(request.getTags() != null ? request.getTags() : List.of()));
        tc.setPriority(request.getPriority() != null ? request.getPriority() : TestCase.Priority.MEDIUM);
        tc.setStatus(request.getStatus() != null ? request.getStatus() : TestCase.Status.DRAFT);
        tc.setCreatedBy(userId);
        TestCase saved = testCaseRepository.save(tc);
        auditService.logCreate("TestCase", saved.getId(), userId, toDto(saved, false));
        return toDto(saved, false);
    }

    @Transactional
    public TestCaseDtos.TestCaseDto updateTestCase(
            String appId, String tcId, TestCaseDtos.UpdateTestCaseRequest request, String userId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        if (request.getName() != null) tc.setName(request.getName());
        if (request.getDescription() != null) tc.setDescription(request.getDescription());
        if (request.getTags() != null) tc.setTags(VariableInterpolator.toJson(request.getTags()));
        if (request.getPriority() != null) tc.setPriority(request.getPriority());
        if (request.getStatus() != null) tc.setStatus(request.getStatus());
        return toDto(testCaseRepository.save(tc), false);
    }

    @Transactional
    public void deleteTestCase(String appId, String tcId, String userId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        testStepRepository.deleteAllByTestCaseId(tcId);
        testCaseRepository.delete(tc);
        auditService.logDelete("TestCase", tcId, userId, toDto(tc, false));
    }

    @Transactional
    public TestCaseDtos.TestCaseDto cloneTestCase(String appId, String tcId, String userId) {
        TestCase source = findByIdAndAppId(appId, tcId);
        TestCase clone = new TestCase();
        clone.setAppId(appId);
        clone.setName(source.getName() + " (copy)");
        clone.setDescription(source.getDescription());
        clone.setTags(source.getTags());
        clone.setPriority(source.getPriority());
        clone.setStatus(TestCase.Status.DRAFT);
        clone.setCreatedBy(userId);
        TestCase savedClone = testCaseRepository.save(clone);

        // Clone all steps
        List<TestStep> sourceSteps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        for (TestStep s : sourceSteps) {
            TestStep cloneStep = new TestStep();
            cloneStep.setTestCaseId(savedClone.getId());
            cloneStep.setSequenceOrder(s.getSequenceOrder());
            cloneStep.setName(s.getName());
            cloneStep.setDescription(s.getDescription());
            cloneStep.setStepType(s.getStepType());
            cloneStep.setActionType(s.getActionType());
            cloneStep.setConfig(s.getConfig());
            cloneStep.setExpectedResult(s.getExpectedResult());
            cloneStep.setGlobalRef(s.isGlobalRef());
            cloneStep.setGlobalStepId(s.getGlobalStepId());
            cloneStep.setEnabled(s.isEnabled());
            testStepRepository.save(cloneStep);
        }
        return toDto(savedClone, false);
    }

    public String exportTestCase(String appId, String tcId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        var export = new java.util.HashMap<String, Object>();
        export.put("testCase", toDto(tc, false));
        export.put("steps", steps.stream().map(this::toStepDto).toList());
        return VariableInterpolator.toJson(export);
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private void validateAppExists(String appId) {
        if (!applicationRepository.existsById(appId)) {
            throw new ResourceNotFoundException("Application", appId);
        }
    }

    private TestCase findByIdAndAppId(String appId, String tcId) {
        TestCase tc = testCaseRepository.findById(tcId)
                .orElseThrow(() -> new ResourceNotFoundException("TestCase", tcId));
        if (!tc.getAppId().equals(appId)) {
            throw new ResourceNotFoundException("TestCase", tcId);
        }
        return tc;
    }

    TestCaseDtos.TestCaseDto toDto(TestCase tc, boolean withStepCount) {
        TestCaseDtos.TestCaseDto dto = new TestCaseDtos.TestCaseDto();
        copyToDto(tc, dto);
        if (withStepCount) {
            dto.setStepCount(testStepRepository.countByTestCaseId(tc.getId()));
        }
        return dto;
    }

    private void copyToDto(TestCase tc, TestCaseDtos.TestCaseDto dto) {
        dto.setId(tc.getId());
        dto.setAppId(tc.getAppId());
        dto.setName(tc.getName());
        dto.setDescription(tc.getDescription());
        dto.setPriority(tc.getPriority().name());
        dto.setStatus(tc.getStatus().name());
        dto.setCreatedBy(tc.getCreatedBy());
        dto.setCreatedAt(tc.getCreatedAt() != null ? tc.getCreatedAt().toString() : null);
        dto.setUpdatedAt(tc.getUpdatedAt() != null ? tc.getUpdatedAt().toString() : null);
        try {
            dto.setTags(objectMapper.readValue(
                    tc.getTags() != null ? tc.getTags() : "[]",
                    new TypeReference<>() {}));
        } catch (Exception e) {
            dto.setTags(List.of());
        }
    }

    TestCaseDtos.TestStepDto toStepDto(TestStep step) {
        TestCaseDtos.TestStepDto dto = new TestCaseDtos.TestStepDto();
        dto.setId(step.getId());
        dto.setTestCaseId(step.getTestCaseId());
        dto.setSequenceOrder(step.getSequenceOrder());
        dto.setName(step.getName());
        dto.setDescription(step.getDescription());
        dto.setStepType(step.getStepType().name());
        dto.setActionType(step.getActionType().name());
        dto.setExpectedResult(step.getExpectedResult());
        dto.setGlobalRef(step.isGlobalRef());
        dto.setGlobalStepId(step.getGlobalStepId());
        dto.setEnabled(step.isEnabled());
        dto.setCreatedAt(step.getCreatedAt() != null ? step.getCreatedAt().toString() : null);
        dto.setUpdatedAt(step.getUpdatedAt() != null ? step.getUpdatedAt().toString() : null);
        try {
            dto.setConfig(objectMapper.readValue(
                    step.getConfig() != null ? step.getConfig() : "{}",
                    Object.class));
        } catch (Exception e) {
            dto.setConfig(new java.util.HashMap<>());
        }
        return dto;
    }

    @Transactional
    public TestCaseDtos.TestCaseDto importOpenApiTestCase(
            String appId, String name, MultipartFile file, String userId) {
        validateAppExists(appId);
        
        try {
            String filename = file.getOriginalFilename();
            boolean isYaml = filename != null && (filename.endsWith(".yaml") || filename.endsWith(".yml"));
            
            ObjectMapper mapper = isYaml 
                    ? new ObjectMapper(new YAMLFactory()) 
                    : new ObjectMapper();
            
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            Map<String, Object> spec = mapper.readValue(content, new TypeReference<Map<String, Object>>() {});
            
            // Extract description
            String description = "Imported from OpenAPI/Swagger Spec";
            Object infoObj = spec.get("info");
            if (infoObj instanceof Map) {
                Map<String, Object> info = (Map<String, Object>) infoObj;
                String title = (String) info.get("title");
                String version = (String) info.get("version");
                if (title != null) {
                    description += ": " + title + (version != null ? " (v" + version + ")" : "");
                }
            }

            // Create TestCase
            TestCase tc = new TestCase();
            tc.setAppId(appId);
            tc.setName(name);
            tc.setDescription(description);
            tc.setTags("[\"imported\", \"openapi\"]");
            tc.setPriority(TestCase.Priority.MEDIUM);
            tc.setStatus(TestCase.Status.DRAFT);
            tc.setCreatedBy(userId);
            TestCase savedTc = testCaseRepository.save(tc);

            // Parse paths
            Object pathsObj = spec.get("paths");
            if (pathsObj instanceof Map) {
                Map<String, Object> paths = (Map<String, Object>) pathsObj;
                int seq = 1;
                
                for (Map.Entry<String, Object> pathEntry : paths.entrySet()) {
                    String rawPath = pathEntry.getKey();
                    // Convert {param} to {{param}}
                    String path = rawPath.replaceAll("\\{([^}]+)\\}", "{{$1}}");
                    
                    if (!(pathEntry.getValue() instanceof Map)) continue;
                    Map<String, Object> ops = (Map<String, Object>) pathEntry.getValue();

                    for (Map.Entry<String, Object> opEntry : ops.entrySet()) {
                        String method = opEntry.getKey();
                        if (!List.of("get", "post", "put", "delete", "patch").contains(method.toLowerCase())) continue;
                        if (!(opEntry.getValue() instanceof Map)) continue;
                        
                        Map<String, Object> op = (Map<String, Object>) opEntry.getValue();
                        String opSummary = (String) op.get("summary");
                        String opDesc = (String) op.get("description");
                        String stepName = opSummary != null && !opSummary.isBlank() 
                                ? opSummary 
                                : (method.toUpperCase() + " " + rawPath);

                        // Parse Headers
                        Map<String, String> headers = new LinkedHashMap<>();
                        headers.put("Content-Type", "application/json");

                        // Parse Body
                        String bodyType = "NONE";
                        String bodyContent = "{}";
                        if (List.of("post", "put", "patch").contains(method.toLowerCase())) {
                            bodyContent = extractMockBody(op);
                            if (!"{}".equals(bodyContent)) {
                                bodyType = "JSON";
                            }
                        }

                        // Assemble HttpRequestConfig
                        Map<String, Object> config = new LinkedHashMap<>();
                        config.put("method", method.toUpperCase());
                        config.put("url", "{{baseUrl}}" + path);
                        config.put("headers", headers);
                        config.put("bodyType", bodyType);
                        config.put("body", bodyContent);
                        config.put("timeoutMs", 30000);

                        TestStep step = new TestStep();
                        step.setTestCaseId(savedTc.getId());
                        step.setSequenceOrder(seq++);
                        step.setName(stepName);
                        step.setDescription(opDesc != null ? opDesc : "Endpoint request step");
                        step.setStepType(TestStep.StepType.HTTP_REQUEST);
                        step.setActionType(TestStep.ActionType.NONE);
                        step.setConfig(VariableInterpolator.toJson(config));
                        step.setEnabled(true);
                        testStepRepository.save(step);
                    }
                }
            }

            auditService.logCreate("TestCase", savedTc.getId(), userId, toDto(savedTc, false));
            return toDto(savedTc, false);

        } catch (IOException e) {
            log.error("Failed to import OpenAPI/Swagger test case: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to read file: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractMockBody(Map<String, Object> operation) {
        try {
            // OpenAPI v3 requestBody content application/json
            Object requestBodyObj = operation.get("requestBody");
            if (requestBodyObj instanceof Map) {
                Map<String, Object> reqBody = (Map<String, Object>) requestBodyObj;
                Object contentObj = reqBody.get("content");
                if (contentObj instanceof Map) {
                    Map<String, Object> content = (Map<String, Object>) contentObj;
                    Object jsonContentObj = content.get("application/json");
                    if (jsonContentObj instanceof Map) {
                        Map<String, Object> jsonContent = (Map<String, Object>) jsonContentObj;
                        Object schemaObj = jsonContent.get("schema");
                        if (schemaObj instanceof Map) {
                            return objectMapper.writeValueAsString(generateMockJson((Map<String, Object>) schemaObj));
                        }
                    }
                }
            }
            
            // Swagger v2 body parameter
            Object paramsObj = operation.get("parameters");
            if (paramsObj instanceof List) {
                for (Object paramObj : (List<?>) paramsObj) {
                    if (paramObj instanceof Map) {
                        Map<String, Object> param = (Map<String, Object>) paramObj;
                        if ("body".equals(param.get("in"))) {
                            Object schemaObj = param.get("schema");
                            if (schemaObj instanceof Map) {
                                return objectMapper.writeValueAsString(generateMockJson((Map<String, Object>) schemaObj));
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to generate mock body schema: {}", e.getMessage());
        }
        return "{}";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> generateMockJson(Map<String, Object> schema) {
        Map<String, Object> mock = new LinkedHashMap<>();
        Object propertiesObj = schema.get("properties");
        if (propertiesObj instanceof Map) {
            Map<String, Object> properties = (Map<String, Object>) propertiesObj;
            for (Map.Entry<String, Object> entry : properties.entrySet()) {
                String key = entry.getKey();
                Object valObj = entry.getValue();
                if (valObj instanceof Map) {
                    Map<String, Object> val = (Map<String, Object>) valObj;
                    String type = (String) val.get("type");
                    if ("string".equalsIgnoreCase(type)) {
                        mock.put(key, val.containsKey("example") ? val.get("example") : "string");
                    } else if ("integer".equalsIgnoreCase(type) || "number".equalsIgnoreCase(type)) {
                        mock.put(key, val.containsKey("example") ? val.get("example") : 0);
                    } else if ("boolean".equalsIgnoreCase(type)) {
                        mock.put(key, val.containsKey("example") ? val.get("example") : false);
                    } else if ("array".equalsIgnoreCase(type)) {
                        mock.put(key, List.of());
                    } else if ("object".equalsIgnoreCase(type)) {
                        mock.put(key, new LinkedHashMap<>());
                    } else {
                        mock.put(key, "value");
                    }
                }
            }
        }
        return mock;
    }
}
