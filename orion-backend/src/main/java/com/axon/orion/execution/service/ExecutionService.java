package com.axon.orion.execution.service;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentDatabase;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.environment.service.EnvironmentService;
import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.dto.ExecutionUpdateEvent;
import com.axon.orion.execution.engine.ExecutionEngine;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import org.springframework.context.event.EventListener;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionService {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestCaseRepository testCaseRepository;
    private final TestStepRepository testStepRepository;
    private final EnvironmentService environmentService;
    private final EnvironmentRepository environmentRepository;
    private final ExecutionEngine executionEngine;
    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;

    // SSE emitter registry for real-time updates
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    @Transactional
    public ExecutionDtos.ExecutionDto triggerExecution(
            ExecutionDtos.TriggerExecutionRequest request, String userId) {
        // Validate test case and environment exist
        if (!testCaseRepository.existsById(request.getTestCaseId())) {
            throw new ResourceNotFoundException("TestCase", request.getTestCaseId());
        }

        // Resolve variable context (global + environment)
        Map<String, String> variableContext = new HashMap<>(environmentService.getResolvedVariableContext(request.getEnvironmentId()));
        if (request.getEnvironmentId() != null) {
            variableContext.put("__environmentId", request.getEnvironmentId());
        }

        // Pre-execution validation
        validateTestCaseExecution(request.getTestCaseId(), variableContext, request.getStepIds());

        // Create execution record
        Execution execution = new Execution();
        execution.setTestCaseId(request.getTestCaseId());
        execution.setEnvironmentId(request.getEnvironmentId());
        execution.setStatus(Execution.Status.QUEUED);
        execution.setTriggeredBy(userId);
        if (request.getStepIds() != null && !request.getStepIds().isEmpty()) {
            execution.setStepIds(String.join(",", request.getStepIds()));
        }
        Execution saved = executionRepository.save(execution);

        // Launch async execution after transaction commits successfully to prevent race condition
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executionEngine.execute(saved.getId(), variableContext);
                }
            });
        } else {
            executionEngine.execute(saved.getId(), variableContext);
        }

        return toDtoWithNames(saved);
    }

    public PagedResponse<ExecutionDtos.ExecutionDto> listExecutions(
            int page, int size, String testCaseId, String environmentId,
            Execution.Status status, String sort) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"createdAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<Execution> page_ = executionRepository.findAllWithFilters(testCaseId, environmentId, status, pageRequest);
        return PagedResponse.of(page_.getContent().stream().map(this::toDtoWithNames).toList(),
                page, size, page_.getTotalElements());
    }

    public PagedResponse<ExecutionDtos.ExecutionDto> listAppExecutions(
            String appId, int page, int size, String sort) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"createdAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<Execution> page_ = executionRepository.findByAppId(appId, pageRequest);
        return PagedResponse.of(page_.getContent().stream().map(this::toDtoWithNames).toList(),
                page, size, page_.getTotalElements());
    }

    public ExecutionDtos.ExecutionDetailDto getExecutionDetail(String execId) {
        Execution exec = findById(execId);
        ExecutionDtos.ExecutionDetailDto dto = new ExecutionDtos.ExecutionDetailDto();
        ExecutionDtos.ExecutionDto base = toDtoWithNames(exec);
        copyBaseFields(base, dto);

        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId);
        List<ExecutionDtos.ExecutionStepLogDto> stepLogDtos = new ArrayList<>();
        for (ExecutionStepLog log : logs) {
            ExecutionDtos.ExecutionStepLogDto logDto = ExecutionDtos.toStepLogDto(log);
            testStepRepository.findById(log.getTestStepId()).ifPresent(step -> {
                logDto.setStepName(step.getName());
                logDto.setStepType(step.getStepType().name());
            });
            stepLogDtos.add(logDto);
        }
        dto.setStepLogs(stepLogDtos);
        return dto;
    }

    public List<ExecutionDtos.ExecutionStepLogDto> getStepLogs(String execId) {
        findById(execId);
        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId);
        List<ExecutionDtos.ExecutionStepLogDto> stepLogDtos = new ArrayList<>();
        for (ExecutionStepLog log : logs) {
            ExecutionDtos.ExecutionStepLogDto logDto = ExecutionDtos.toStepLogDto(log);
            testStepRepository.findById(log.getTestStepId()).ifPresent(step -> {
                logDto.setStepName(step.getName());
                logDto.setStepType(step.getStepType().name());
            });
            stepLogDtos.add(logDto);
        }
        return stepLogDtos;
    }

    @Transactional
    public ExecutionDtos.ExecutionDto cancelExecution(String execId) {
        Execution exec = findById(execId);
        if (exec.getStatus() == Execution.Status.QUEUED || exec.getStatus() == Execution.Status.RUNNING) {
            exec.setStatus(Execution.Status.CANCELLED);
            executionRepository.save(exec);
        }
        return toDtoWithNames(exec);
    }

    @Transactional
    public ExecutionDtos.ExecutionDto rerunExecution(String execId, String userId) {
        Execution original = findById(execId);
        ExecutionDtos.TriggerExecutionRequest request = new ExecutionDtos.TriggerExecutionRequest();
        request.setTestCaseId(original.getTestCaseId());
        request.setEnvironmentId(original.getEnvironmentId());
        if (original.getStepIds() != null && !original.getStepIds().isBlank()) {
            request.setStepIds(java.util.Arrays.asList(original.getStepIds().split(",")));
        }
        return triggerExecution(request, userId);
    }

    public SseEmitter streamExecution(String execId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.computeIfAbsent(execId, k -> new ArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(execId, emitter));
        emitter.onTimeout(() -> removeEmitter(execId, emitter));

        // Send current state immediately
        try {
            Execution exec = findById(execId);
            emitter.send(SseEmitter.event()
                    .name("execution-update")
                    .data(toDtoWithNames(exec)));
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
        return emitter;
    }

    public void notifyExecutionUpdate(String execId, ExecutionDtos.ExecutionDto dto) {
        List<SseEmitter> emitterList = emitters.getOrDefault(execId, List.of());
        emitterList.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("execution-update").data(dto));
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        });
    }

    public ExecutionDtos.ExecutionStatsDto getDashboardStats() {
        long total = executionRepository.count();
        long passed = executionRepository.findAllWithFilters(null, null, Execution.Status.PASSED,
                PageRequest.of(0, 1)).getTotalElements();
        long failed = executionRepository.findAllWithFilters(null, null, Execution.Status.FAILED,
                PageRequest.of(0, 1)).getTotalElements();
        long running = executionRepository.findAllWithFilters(null, null, Execution.Status.RUNNING,
                PageRequest.of(0, 1)).getTotalElements();

        ExecutionDtos.ExecutionStatsDto stats = new ExecutionDtos.ExecutionStatsDto();
        stats.setTotalExecutions(total);
        stats.setPassedExecutions(passed);
        stats.setFailedExecutions(failed);
        stats.setRunningExecutions(running);
        stats.setPassRate(total > 0 ? (double) passed / total * 100 : 0);
        return stats;
    }

    private Execution findById(String execId) {
        return executionRepository.findById(execId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", execId));
    }

    private void removeEmitter(String execId, SseEmitter emitter) {
        emitters.computeIfPresent(execId, (k, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }

    private void copyBaseFields(ExecutionDtos.ExecutionDto src, ExecutionDtos.ExecutionDetailDto dst) {
        dst.setId(src.getId());
        dst.setTestCaseId(src.getTestCaseId());
        dst.setTestCaseName(src.getTestCaseName());
        dst.setEnvironmentId(src.getEnvironmentId());
        dst.setEnvironmentName(src.getEnvironmentName());
        dst.setStatus(src.getStatus());
        dst.setTriggeredBy(src.getTriggeredBy());
        dst.setStartedAt(src.getStartedAt());
        dst.setCompletedAt(src.getCompletedAt());
        dst.setDurationMs(src.getDurationMs());
        dst.setTotalSteps(src.getTotalSteps());
        dst.setPassedSteps(src.getPassedSteps());
        dst.setFailedSteps(src.getFailedSteps());
        dst.setErrorMessage(src.getErrorMessage());
        dst.setCreatedAt(src.getCreatedAt());
    }

    public ExecutionDtos.ExecutionDto toDtoWithNames(Execution exec) {
        ExecutionDtos.ExecutionDto dto = ExecutionDtos.toDto(exec);
        testCaseRepository.findById(exec.getTestCaseId())
                .ifPresent(tc -> dto.setTestCaseName(tc.getName()));
        if (exec.getEnvironmentId() != null) {
            environmentRepository.findById(exec.getEnvironmentId())
                    .ifPresent(env -> dto.setEnvironmentName(env.getName()));
        }
        return dto;
    }

    private Set<String> extractVariablesUsed(String configJson) {
        if (configJson == null) return Set.of();
        Set<String> vars = new HashSet<>();
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\{\\{([A-Za-z0-9_]+)\\}\\}");
        java.util.regex.Matcher matcher = pattern.matcher(configJson);
        while (matcher.find()) {
            vars.add(matcher.group(1));
        }
        return vars;
    }

    private void validateTestCaseExecution(String testCaseId, Map<String, String> initialContext, List<String> allowedStepIds) {
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(testCaseId);
        if (allowedStepIds != null && !allowedStepIds.isEmpty()) {
            steps = steps.stream().filter(s -> allowedStepIds.contains(s.getId())).toList();
        }
        
        Set<String> availableVariables = new HashSet<>(initialContext.keySet());
        // System variables that are dynamically created during execution
        availableVariables.add("__lastStatusCode");
        availableVariables.add("__lastResponseBody");
        availableVariables.add("__environmentId");

        for (TestStep step : steps) {
            if (!step.isEnabled()) {
                continue;
            }
            // Extract all variables referenced in the step config
            Set<String> referencedVars = extractVariablesUsed(step.getConfig());
            
            // For PARALLEL steps, also check variables referenced in child steps
            if (step.getStepType() == TestStep.StepType.PARALLEL) {
                try {
                    Map<String, Object> parentConfig = objectMapper.readValue(step.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> subSteps = (List<Map<String, Object>>) parentConfig.getOrDefault("steps", List.of());
                    for (Map<String, Object> subStep : subSteps) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> subConfig = (Map<String, Object>) subStep.getOrDefault("config", Map.of());
                        String subConfigJson = objectMapper.writeValueAsString(subConfig);
                        referencedVars.addAll(extractVariablesUsed(subConfigJson));
                    }
                } catch (Exception e) {
                    // Ignore parsing error
                }
            }

            // Check if all referenced variables are available
            for (String varName : referencedVars) {
                if (varName.startsWith("__lastHeader_")) {
                    continue;
                }
                if (!availableVariables.contains(varName)) {
                    throw new IllegalArgumentException(String.format(
                        "Validation error in Step %d (%s): Variable '%s' is not defined. " +
                        "Define it in your environment variables, global configurations, or extract it in a preceding step.",
                        step.getSequenceOrder(), step.getName(), varName
                    ));
                }
            }

            // Database query step validation (both DATABASE_QUERY and DB_TABLE_VIEW run queries)
            if (step.getStepType() == TestStep.StepType.DATABASE_QUERY
                    || step.getStepType() == TestStep.StepType.DB_TABLE_VIEW) {
                validateDatabaseConnection(step, initialContext);
            }
            
            // Parallel step database validation
            if (step.getStepType() == TestStep.StepType.PARALLEL) {
                try {
                    Map<String, Object> parentConfig = objectMapper.readValue(step.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> subSteps = (List<Map<String, Object>>) parentConfig.getOrDefault("steps", List.of());
                    for (Map<String, Object> subStep : subSteps) {
                        String subTypeStr = (String) subStep.getOrDefault("stepType", "");
                        if ("DATABASE_QUERY".equals(subTypeStr) || "DB_TABLE_VIEW".equals(subTypeStr)) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> subConfig = (Map<String, Object>) subStep.getOrDefault("config", Map.of());
                            validateDatabaseConnectionFromConfig((String) subStep.getOrDefault("name", "Parallel DB Query"), subConfig, initialContext);
                        }
                    }
                } catch (IllegalArgumentException e) {
                    throw e;
                } catch (Exception e) {
                    // Ignore other errors
                }
            }

            // Post-execution: update available variables
            if (step.getStepType() == TestStep.StepType.SET_VARIABLE) {
                try {
                    Map<String, Object> configMap = objectMapper.readValue(step.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                    String varName = (String) configMap.get("variableName");
                    if (varName != null && !varName.isBlank()) {
                        availableVariables.add(varName);
                    }
                } catch (Exception e) {
                    // Ignore parsing error
                }
            }

            // Update variables set in parallel steps
            if (step.getStepType() == TestStep.StepType.PARALLEL) {
                try {
                    Map<String, Object> parentConfig = objectMapper.readValue(step.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> subSteps = (List<Map<String, Object>>) parentConfig.getOrDefault("steps", List.of());
                    for (Map<String, Object> subStep : subSteps) {
                        String subTypeStr = (String) subStep.getOrDefault("stepType", "");
                        if ("SET_VARIABLE".equals(subTypeStr)) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> subConfig = (Map<String, Object>) subStep.getOrDefault("config", Map.of());
                            String varName = (String) subConfig.get("variableName");
                            if (varName != null && !varName.isBlank()) {
                                availableVariables.add(varName);
                            }
                        }
                    }
                } catch (Exception e) {
                    // Ignore parsing error
                }
            }
        }
    }

    private void validateDatabaseConnection(TestStep step, Map<String, String> initialContext) {
        try {
            Map<String, Object> configMap = objectMapper.readValue(step.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
            validateDatabaseConnectionFromConfig(step.getName(), configMap, initialContext);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Validation error in Step '" + step.getName() + "': Invalid step configuration JSON: " + e.getMessage(), e);
        }
    }

    private void validateDatabaseConnectionFromConfig(String stepName, Map<String, Object> configMap, Map<String, String> initialContext) {
        String databaseKey = (String) configMap.get("databaseKey");
        String connStr = null;
        String username = null;
        String password = null;
        com.axon.orion.environment.entity.Environment env = null;
        EnvironmentDatabase targetDb = null;
        String clientCertBase64 = null;
        String clientCertPassword = null;

        if (databaseKey != null && !databaseKey.isBlank()) {
            String envId = initialContext.get("__environmentId");
            if (envId == null || envId.isBlank()) {
                throw new IllegalArgumentException(String.format(
                    "Validation error in Step '%s': Target environment is not specified in execution context for database key lookup.", stepName
                ));
            }

            var envOpt = environmentRepository.findById(envId);
            if (envOpt.isEmpty()) {
                throw new IllegalArgumentException(String.format(
                    "Validation error in Step '%s': Target environment not found for ID: %s.", stepName, envId
                ));
            }

            env = envOpt.get();
            
            targetDb = env.getDbConnections().stream()
                    .filter(db -> databaseKey.equals(db.getName()) || databaseKey.equals(db.getId()))
                    .findFirst()
                    .orElse(null);

            if (targetDb == null) {
                throw new IllegalArgumentException(String.format(
                    "Validation error in Step '%s': Database connection with key '%s' is not configured in environment %s.", stepName, databaseKey, env.getName()
                ));
            }

            String type = (targetDb.getType() != null ? targetDb.getType() : "SQLITE").toUpperCase();
            String host = targetDb.getHost();
            Integer portNum = targetDb.getPort();
            String port = portNum != null ? String.valueOf(portNum) : "";
            String databaseName = targetDb.getDatabaseName();
            username = targetDb.getUsername();
            password = encryptionService.decrypt(targetDb.getPassword());

            String certificateKey = targetDb.getCertificateKey();
            if (certificateKey != null && !certificateKey.isBlank()) {
                com.axon.orion.environment.entity.EnvironmentCertificate targetCert = env.getCertificates().stream()
                        .filter(c -> certificateKey.equals(c.getName()) || certificateKey.equals(c.getId()))
                        .findFirst()
                        .orElse(null);

                if (targetCert != null) {
                    clientCertBase64 = targetCert.getClientCert();
                    clientCertPassword = encryptionService.decrypt(targetCert.getClientCertPassword());
                }
            }

            // Fallback to environment default certificate
            if (clientCertBase64 == null || clientCertBase64.isBlank()) {
                clientCertBase64 = env.getSslClientCert();
                clientCertPassword = encryptionService.decrypt(env.getSslClientCertPassword());
            }

            String customUrl = targetDb.getConnectionUrl();
            if (customUrl != null && !customUrl.isBlank()) {
                connStr = customUrl;
            } else {
                if ("POSTGRESQL".equals(type) || "COCKROACHDB".equals(type)) {
                    connStr = String.format("jdbc:postgresql://%s:%s/%s", host, port, databaseName);
                } else if ("MYSQL".equals(type)) {
                    connStr = String.format("jdbc:mysql://%s:%s/%s", host, port, databaseName);
                } else if ("ORACLE".equals(type)) {
                    connStr = String.format("jdbc:oracle:thin:@//%s:%s/%s", host, port, databaseName);
                } else if ("DB2".equals(type)) {
                    connStr = String.format("jdbc:db2://%s:%s/%s", host, port, databaseName);
                } else if ("SQLITE".equals(type)) {
                    connStr = String.format("jdbc:sqlite:%s", databaseName);
                } else {
                    throw new IllegalArgumentException(String.format(
                        "Validation error in Step '%s': Unsupported database type: %s.", stepName, type
                    ));
                }
            }
        } else {
            String connStrRaw = (String) configMap.get("connectionString");
            if (connStrRaw == null || connStrRaw.isBlank()) {
                throw new IllegalArgumentException(String.format(
                    "Validation error in Step '%s': JDBC connection string must not be empty.", stepName
                ));
            }

            connStr = com.axon.orion.common.util.VariableInterpolator.resolve(connStrRaw, initialContext);
            if (connStr.contains("{{") && connStr.contains("}}")) {
                throw new IllegalArgumentException(String.format(
                    "Validation error in Step '%s': Database connection string contains unresolved variables.", stepName
                ));
            }
        }

        log.info("Validating database connection for step '{}' using URL: {}", stepName, connStr);

        java.nio.file.Path tempCert = null;
        if (clientCertBase64 != null && !clientCertBase64.trim().isEmpty()) {
            try {
                String prefix = connStr != null && connStr.startsWith("jdbc:db2:") ? "orion_db2_val_" : "orion_db_val_";
                tempCert = java.nio.file.Files.createTempFile(prefix, ".p12");
                java.nio.file.Files.write(tempCert, Base64.getDecoder().decode(clientCertBase64.trim()));
            } catch (Exception e) {
                log.error("Failed to write temporary certificate file for database validation: {}", e.getMessage());
            }
        }

        if (tempCert != null) {
            String certLocation = tempCert.toAbsolutePath().toString();
            String certPlaceholder = null;
            if (targetDb != null) {
                certPlaceholder = targetDb.getCertPlaceholder();
            }

            if (certPlaceholder != null && !certPlaceholder.isBlank()) {
                if (connStr != null) connStr = connStr.replace(certPlaceholder, certLocation);
                if (username != null) username = username.replace(certPlaceholder, certLocation);
                if (password != null) password = password.replace(certPlaceholder, certLocation);
            }

            // Fallback default placeholder {{CERT_PATH}}
            if (connStr != null) connStr = connStr.replace("{{CERT_PATH}}", certLocation);
            if (username != null) username = username.replace("{{CERT_PATH}}", certLocation);
            if (password != null) password = password.replace("{{CERT_PATH}}", certLocation);
        }

        java.sql.Connection conn = null;
        try {
            if (tempCert != null && connStr != null && connStr.startsWith("jdbc:db2:")) {
                Properties props = new Properties();
                props.setProperty("user", username != null ? username : "");
                props.setProperty("password", password != null ? password : "");
                props.setProperty("sslConnection", "true");
                String certPath = tempCert.toAbsolutePath().toString();
                String certPass = clientCertPassword != null ? clientCertPassword : "";
                props.setProperty("sslTrustStoreLocation", certPath);
                props.setProperty("sslTrustStorePassword", certPass);
                props.setProperty("sslTrustStoreType", "PKCS12");
                props.setProperty("sslKeyStoreLocation", certPath);
                props.setProperty("sslKeyStorePassword", certPass);
                props.setProperty("sslKeyStoreType", "PKCS12");
                conn = java.sql.DriverManager.getConnection(connStr, props);
            } else {
                if (username != null && !username.isBlank()) {
                    conn = java.sql.DriverManager.getConnection(connStr, username, password);
                } else {
                    conn = java.sql.DriverManager.getConnection(connStr);
                }
            }
        } catch (java.sql.SQLException e) {
            throw new IllegalArgumentException(String.format(
                "Validation error in Step '%s': Database connection failed. Error: %s", stepName, e.getMessage()
            ), e);
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (java.sql.SQLException e) {
                    // Ignore
                }
            }
            if (tempCert != null) {
                try {
                    java.nio.file.Files.deleteIfExists(tempCert);
                } catch (Exception e) {
                    log.warn("Failed to delete temporary certificate: {}", e.getMessage());
                }
            }
        }
    }

    @EventListener
    public void handleExecutionUpdate(ExecutionUpdateEvent event) {
        try {
            ExecutionDtos.ExecutionDetailDto detail = getExecutionDetail(event.executionId());
            notifyExecutionUpdate(event.executionId(), detail);
        } catch (Exception e) {
            log.error("Failed to broadcast execution update for event: {}", event, e);
        }
    }
}
