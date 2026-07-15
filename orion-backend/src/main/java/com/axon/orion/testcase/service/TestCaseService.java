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
    private final com.axon.orion.testcase.repository.TestCaseSnapshotRepository testCaseSnapshotRepository;
    private ObjectMapper yamlMapper = new ObjectMapper(new com.fasterxml.jackson.dataformat.yaml.YAMLFactory());

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

    public String exportTestCase(String appId, String tcId, String format) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        var export = new java.util.HashMap<String, Object>();
        export.put("testCase", toDto(tc, false));
        export.put("steps", steps.stream().map(this::toStepDto).toList());
        
        if ("yaml".equalsIgnoreCase(format) || "yml".equalsIgnoreCase(format)) {
            try {
                return yamlMapper.writerWithDefaultPrettyPrinter().writeValueAsString(export);
            } catch (Exception e) {
                log.error("Failed to export test case to YAML", e);
                throw new RuntimeException("Failed to export test case to YAML: " + e.getMessage());
            }
        }
        return VariableInterpolator.toJson(export);
    }

    @SuppressWarnings("unchecked")
    public TestCaseDtos.ImportValidationResponse validateYamlImport(String appId, MultipartFile file) {
        validateAppExists(appId);
        TestCaseDtos.ImportValidationResponse response = new TestCaseDtos.ImportValidationResponse();
        response.setValid(false);
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            Map<String, Object> data = yamlMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
            
            if (data == null || !data.containsKey("testCase")) {
                errors.add("Invalid Orion Test Case format: Root element 'testCase' is missing");
                response.setErrors(errors);
                response.setWarnings(warnings);
                return response;
            }

            Map<String, Object> tcMap = (Map<String, Object>) data.get("testCase");
            String tcName = (String) tcMap.get("name");
            if (tcName == null || tcName.isBlank()) {
                errors.add("Test case name is required");
            }
            response.setTestCaseName(tcName);
            response.setTestCaseDescription((String) tcMap.get("description"));

            List<Map<String, Object>> stepsList = (List<Map<String, Object>>) data.get("steps");
            int stepCount = stepsList != null ? stepsList.size() : 0;
            response.setStepCount(stepCount);

            if (stepsList != null) {
                for (int i = 0; i < stepsList.size(); i++) {
                    int index = i + 1;
                    Map<String, Object> stepMap = stepsList.get(i);
                    String stepName = (String) stepMap.get("name");
                    String stepTypeStr = (String) stepMap.get("stepType");

                    if (stepName == null || stepName.isBlank()) {
                        errors.add("Step #" + index + ": Step name is required");
                    }
                    if (stepTypeStr == null || stepTypeStr.isBlank()) {
                        errors.add("Step #" + index + " (" + (stepName != null ? stepName : "unnamed") + "): stepType is required");
                    } else {
                        try {
                            TestStep.StepType.valueOf(stepTypeStr);
                        } catch (IllegalArgumentException e) {
                            errors.add("Step #" + index + " (" + (stepName != null ? stepName : "unnamed") + "): invalid stepType '" + stepTypeStr + "'");
                        }
                    }

                    // Validate Step Configuration constraints to avoid runtime failures
                    validateStepConfigConstraints(stepName, stepTypeStr, stepMap.get("config"), errors, warnings, index);
                }
            }

            response.setErrors(errors);
            response.setWarnings(warnings);
            response.setValid(errors.isEmpty());
            return response;

        } catch (Exception e) {
            log.error("Failed to parse YAML testcase: {}", e.getMessage(), e);
            errors.add("Failed to parse YAML file: " + e.getMessage());
            response.setErrors(errors);
            response.setWarnings(warnings);
            return response;
        }
    }

    @SuppressWarnings("unchecked")
    private void validateStepConfigConstraints(String stepName, String stepTypeStr, Object configObj, List<String> errors, List<String> warnings, int index) {
        if (configObj == null) {
            return;
        }
        if (!(configObj instanceof Map)) {
            warnings.add("Step #" + index + " (" + stepName + "): config is not a valid map structure");
            return;
        }
        Map<String, Object> config = (Map<String, Object>) configObj;

        if ("HTTP_REQUEST".equalsIgnoreCase(stepTypeStr)) {
            if (config.get("url") == null || String.valueOf(config.get("url")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): HTTP Request URL is required.");
            }
        } else if ("SOAP_REQUEST".equalsIgnoreCase(stepTypeStr)) {
            if (config.get("url") == null || String.valueOf(config.get("url")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): SOAP Request URL is required.");
            }
            if (config.get("envelope") == null || String.valueOf(config.get("envelope")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): SOAP Request Envelope is required.");
            }
        } else if ("DATABASE_QUERY".equalsIgnoreCase(stepTypeStr)) {
            boolean hasKey = config.get("databaseKey") != null && !String.valueOf(config.get("databaseKey")).isBlank();
            boolean hasConn = config.get("connectionString") != null && !String.valueOf(config.get("connectionString")).isBlank();
            if (!hasKey && !hasConn) {
                errors.add("Step #" + index + " (" + stepName + "): databaseKey or connectionString is required for DATABASE_QUERY.");
            }
            if (config.get("query") == null || String.valueOf(config.get("query")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): query is required for DATABASE_QUERY.");
            }
        } else if ("DB_TABLE_VIEW".equalsIgnoreCase(stepTypeStr)) {
            boolean hasKey = config.get("databaseKey") != null && !String.valueOf(config.get("databaseKey")).isBlank();
            boolean hasConn = config.get("connectionString") != null && !String.valueOf(config.get("connectionString")).isBlank();
            if (!hasKey && !hasConn) {
                errors.add("Step #" + index + " (" + stepName + "): databaseKey or connectionString is required for DB_TABLE_VIEW.");
            }
            if (config.get("tableName") == null || String.valueOf(config.get("tableName")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): tableName is required for DB_TABLE_VIEW.");
            }
        } else if ("CSV_EXTRACT".equalsIgnoreCase(stepTypeStr)) {
            String source = (String) config.getOrDefault("datasetSource", "DESIGNER");
            if ("ENVIRONMENT".equalsIgnoreCase(source)) {
                if (config.get("datasetName") == null || String.valueOf(config.get("datasetName")).isBlank()) {
                    errors.add("Step #" + index + " (" + stepName + "): datasetName is required when datasetSource is ENVIRONMENT.");
                }
            } else {
                if (config.get("rawCsv") == null || String.valueOf(config.get("rawCsv")).isBlank()) {
                    errors.add("Step #" + index + " (" + stepName + "): rawCsv is required when datasetSource is DESIGNER.");
                }
            }
        } else if ("GRAPHQL_REQUEST".equalsIgnoreCase(stepTypeStr)) {
            if (config.get("url") == null || String.valueOf(config.get("url")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): GraphQL Endpoint URL is required.");
            }
            if (config.get("query") == null || String.valueOf(config.get("query")).isBlank()) {
                errors.add("Step #" + index + " (" + stepName + "): GraphQL Query/Mutation string is required.");
            }
        }
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public TestCaseDtos.TestCaseDto importYamlTestCase(String appId, MultipartFile file, String userId) {
        validateAppExists(appId);
        
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            Map<String, Object> data = yamlMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
            
            if (data == null || !data.containsKey("testCase")) {
                throw new IllegalArgumentException("Invalid Orion Test Case format: Root element 'testCase' is missing");
            }

            Map<String, Object> tcMap = (Map<String, Object>) data.get("testCase");
            String tcName = (String) tcMap.get("name");
            if (tcName == null || tcName.isBlank()) {
                throw new IllegalArgumentException("Test case name is required");
            }

            // Create TestCase
            TestCase tc = new TestCase();
            tc.setAppId(appId);
            tc.setName(tcName);
            tc.setDescription((String) tcMap.get("description"));
            
            Object tagsObj = tcMap.get("tags");
            if (tagsObj instanceof List) {
                tc.setTags(objectMapper.writeValueAsString(tagsObj));
            } else {
                tc.setTags("[]");
            }

            String priorityStr = (String) tcMap.get("priority");
            tc.setPriority(priorityStr != null ? TestCase.Priority.valueOf(priorityStr) : TestCase.Priority.MEDIUM);
            
            String statusStr = (String) tcMap.get("status");
            tc.setStatus(statusStr != null ? TestCase.Status.valueOf(statusStr) : TestCase.Status.DRAFT);
            
            tc.setCreatedBy(userId);
            TestCase savedTc = testCaseRepository.save(tc);

            // Import steps
            List<Map<String, Object>> stepsList = (List<Map<String, Object>>) data.get("steps");
            if (stepsList != null) {
                int seq = 1;
                for (Map<String, Object> stepMap : stepsList) {
                    TestStep step = new TestStep();
                    step.setTestCaseId(savedTc.getId());
                    step.setSequenceOrder(stepMap.containsKey("sequenceOrder") ? (Integer) stepMap.get("sequenceOrder") : seq++);
                    
                    String stepName = (String) stepMap.get("name");
                    step.setName(stepName != null ? stepName : "Step " + step.getSequenceOrder());
                    step.setDescription((String) stepMap.get("description"));
                    
                    String stepTypeStr = (String) stepMap.get("stepType");
                    step.setStepType(stepTypeStr != null ? TestStep.StepType.valueOf(stepTypeStr) : TestStep.StepType.HTTP_REQUEST);
                    
                    String actionTypeStr = (String) stepMap.get("actionType");
                    step.setActionType(actionTypeStr != null ? TestStep.ActionType.valueOf(actionTypeStr) : TestStep.ActionType.NONE);
                    
                    Object configObj = stepMap.get("config");
                    if (configObj != null) {
                        step.setConfig(objectMapper.writeValueAsString(configObj));
                    } else {
                        step.setConfig("{}");
                    }
                    
                    step.setExpectedResult((String) stepMap.get("expectedResult"));
                    step.setGlobalRef(stepMap.containsKey("globalRef") ? (Boolean) stepMap.get("globalRef") : false);
                    step.setGlobalStepId((String) stepMap.get("globalStepId"));
                    step.setEnabled(!stepMap.containsKey("enabled") || (Boolean) stepMap.get("enabled"));
                    
                    testStepRepository.save(step);
                }
            }

            auditService.logCreate("TestCase", savedTc.getId(), userId, toDto(savedTc, false));
            return toDto(savedTc, false);

        } catch (Exception e) {
            log.error("Failed to import YAML test case: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to import test case: " + e.getMessage(), e);
        }
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public TestCaseDtos.TestCaseDto updateTestCaseYaml(String appId, String tcId, MultipartFile file, String userId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        TestCaseDtos.TestCaseDto previous = toDto(tc, false);
        
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            Map<String, Object> data = yamlMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
            
            if (data == null || !data.containsKey("testCase")) {
                throw new IllegalArgumentException("Invalid Orion Test Case format: Root element 'testCase' is missing");
            }

            Map<String, Object> tcMap = (Map<String, Object>) data.get("testCase");
            String tcName = (String) tcMap.get("name");
            if (tcName == null || tcName.isBlank()) {
                throw new IllegalArgumentException("Test case name is required");
            }

            // Update TestCase metadata
            tc.setName(tcName);
            tc.setDescription((String) tcMap.get("description"));
            
            Object tagsObj = tcMap.get("tags");
            if (tagsObj instanceof List) {
                tc.setTags(objectMapper.writeValueAsString(tagsObj));
            }

            String priorityStr = (String) tcMap.get("priority");
            if (priorityStr != null) {
                tc.setPriority(TestCase.Priority.valueOf(priorityStr));
            }
            
            String statusStr = (String) tcMap.get("status");
            if (statusStr != null) {
                tc.setStatus(TestCase.Status.valueOf(statusStr));
            }
            
            testCaseRepository.save(tc);

            // Delete all existing steps for this test case
            testStepRepository.deleteAllByTestCaseId(tcId);

            // Save new steps
            List<Map<String, Object>> stepsList = (List<Map<String, Object>>) data.get("steps");
            if (stepsList != null) {
                int seq = 1;
                for (Map<String, Object> stepMap : stepsList) {
                    TestStep step = new TestStep();
                    step.setTestCaseId(tc.getId());
                    step.setSequenceOrder(stepMap.containsKey("sequenceOrder") ? (Integer) stepMap.get("sequenceOrder") : seq++);
                    
                    String stepName = (String) stepMap.get("name");
                    step.setName(stepName != null ? stepName : "Step " + step.getSequenceOrder());
                    step.setDescription((String) stepMap.get("description"));
                    
                    String stepTypeStr = (String) stepMap.get("stepType");
                    step.setStepType(stepTypeStr != null ? TestStep.StepType.valueOf(stepTypeStr) : TestStep.StepType.HTTP_REQUEST);
                    
                    String actionTypeStr = (String) stepMap.get("actionType");
                    step.setActionType(actionTypeStr != null ? TestStep.ActionType.valueOf(actionTypeStr) : TestStep.ActionType.NONE);
                    
                    Object configObj = stepMap.get("config");
                    if (configObj != null) {
                        step.setConfig(objectMapper.writeValueAsString(configObj));
                    } else {
                        step.setConfig("{}");
                    }
                    
                    step.setExpectedResult((String) stepMap.get("expectedResult"));
                    step.setGlobalRef(stepMap.containsKey("globalRef") ? (Boolean) stepMap.get("globalRef") : false);
                    step.setGlobalStepId((String) stepMap.get("globalStepId"));
                    step.setEnabled(!stepMap.containsKey("enabled") || (Boolean) stepMap.get("enabled"));
                    
                    testStepRepository.save(step);
                }
            }

            auditService.logUpdate("TestCase", tc.getId(), userId, previous, toDto(tc, false));
            return toDto(tc, false);

        } catch (Exception e) {
            log.error("Failed to update YAML testcase: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to update test case: " + e.getMessage(), e);
        }
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
        dto.setVersion(tc.getVersion());
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

    private String getCurrentUserId() {
        org.springframework.security.core.Authentication auth = 
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof com.axon.orion.user.entity.User user) {
            return user.getId();
        }
        return "SYSTEM";
    }

    @Transactional
    public void captureSnapshot(String tcId) {
        captureSnapshot(tcId, getCurrentUserId());
    }

    @Transactional
    public void captureSnapshot(String tcId, String userId) {
        TestCase tc = testCaseRepository.findById(tcId)
                .orElseThrow(() -> new ResourceNotFoundException("TestCase", tcId));
        
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        try {
            String stepsSnapshot = objectMapper.writeValueAsString(steps);
            
            // Increment version
            int newVersion = tc.getVersion() + 1;
            tc.setVersion(newVersion);
            testCaseRepository.save(tc);

            com.axon.orion.testcase.entity.TestCaseSnapshot snapshot = new com.axon.orion.testcase.entity.TestCaseSnapshot();
            snapshot.setTestCaseId(tcId);
            snapshot.setVersion(newVersion);
            snapshot.setStepsSnapshot(stepsSnapshot);
            snapshot.setCreatedBy(userId != null ? userId : "SYSTEM");
            testCaseSnapshotRepository.save(snapshot);

            log.info("Captured test case snapshot for tcId={}, version={}", tcId, newVersion);
        } catch (Exception e) {
            log.error("Failed to capture test case snapshot: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to capture test case snapshot: " + e.getMessage(), e);
        }
    }
}
