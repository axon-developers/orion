package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.axon.orion.execution.dto.ExecutionUpdateEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import com.axon.orion.global_config.repository.GlobalEnvConfigRepository;

@Slf4j
@Component
public class ExecutionEngine {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestStepRepository testStepRepository;
    private final ObjectMapper objectMapper;
    private final ExecutionConnectionPool connectionPool;
    private final MainframeSessionPool mainframeSessionPool;
    private final GlobalEnvConfigRepository globalEnvConfigRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final com.axon.orion.user.repository.UserRepository userRepository;
    private final com.axon.orion.execution.service.ExecutionReportService reportService;

    // Step executor registry
    private final Map<TestStep.StepType, StepExecutor> executorMap = new HashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public ExecutionEngine(
            ExecutionRepository executionRepository,
            ExecutionStepLogRepository stepLogRepository,
            TestStepRepository testStepRepository,
            ObjectMapper objectMapper,
            List<StepExecutor> executors,
            ExecutionConnectionPool connectionPool,
            MainframeSessionPool mainframeSessionPool,
            GlobalEnvConfigRepository globalEnvConfigRepository,
            ApplicationEventPublisher eventPublisher,
            com.axon.orion.user.repository.UserRepository userRepository,
            @org.springframework.context.annotation.Lazy com.axon.orion.execution.service.ExecutionReportService reportService
    ) {
        this.executionRepository = executionRepository;
        this.stepLogRepository = stepLogRepository;
        this.testStepRepository = testStepRepository;
        this.objectMapper = objectMapper;
        this.connectionPool = connectionPool;
        this.mainframeSessionPool = mainframeSessionPool;
        this.globalEnvConfigRepository = globalEnvConfigRepository;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
        this.reportService = reportService;
        for (StepExecutor exec : executors) {
            for (TestStep.StepType type : exec.supportedTypes()) {
                executorMap.put(type, exec);
            }
        }
    }

    @Async("executionTaskExecutor")
    public void execute(String executionId, Map<String, String> variableContext) {
        Execution execution = executionRepository.findById(executionId).orElse(null);
        if (execution == null) {
            log.error("Execution not found: {}", executionId);
            return;
        }

        if (execution.getStatus() == Execution.Status.CANCELLED) {
            log.info("Execution {} has already been cancelled in queue. Skipping run.", executionId);
            return;
        }

        org.slf4j.MDC.put("executionId", executionId);
        org.slf4j.MDC.put("testCaseId", execution.getTestCaseId());

        try {
            // Status → RUNNING
            execution.setStatus(Execution.Status.RUNNING);
            execution.setStartedAt(Instant.now());
            executionRepository.save(execution);
            eventPublisher.publishEvent(new ExecutionUpdateEvent(executionId));

            List<TestStep> steps = testStepRepository
                    .findByTestCaseIdOrderBySequenceOrderAsc(execution.getTestCaseId());

            if (execution.getStepIds() != null && !execution.getStepIds().isBlank()) {
                List<String> allowedIds = java.util.Arrays.asList(execution.getStepIds().split(","));
                steps = steps.stream().filter(s -> allowedIds.contains(s.getId())).toList();
            }

            execution.setTotalSteps(steps.size());
            executionRepository.save(execution);

            // Mutable runtime variable context
            Map<String, String> context = new LinkedHashMap<>(variableContext);
            context.put("__executionId", executionId);
            int passedSteps = 0;
            int failedSteps = 0;
            boolean aborted = false;

            int i = 0;
            while (i < steps.size()) {
                TestStep step = steps.get(i);
                
                // Check if this step should be skipped (e.g. it was run inside a Loop step)
                String skippedOrdersStr = context.get("__skippedStepOrders");
                if (skippedOrdersStr != null && !skippedOrdersStr.isBlank()) {
                    Set<Integer> skippedOrders = Arrays.stream(skippedOrdersStr.split(","))
                            .map(String::trim)
                            .map(Integer::parseInt)
                            .collect(Collectors.toSet());
                    if (skippedOrders.contains(step.getSequenceOrder())) {
                        i++;
                        continue;
                    }
                }

                if (!step.isEnabled()) {
                    ExecutionStepLog skipped = createStepLog(executionId, step);
                    skipped.setStatus(ExecutionStepLog.Status.SKIPPED);
                    skipped.setDurationMs(0L);
                    skipped.setErrorMessage("Step is disabled");
                    stepLogRepository.save(skipped);
                    i++;
                    continue;
                }

                if (aborted) {
                    // Log remaining steps as SKIPPED
                    ExecutionStepLog skipped = createStepLog(executionId, step);
                    skipped.setStatus(ExecutionStepLog.Status.SKIPPED);
                    stepLogRepository.save(skipped);
                    i++;
                    continue;
                }

                ExecutionStepLog stepLog = createStepLog(executionId, step);
                stepLog.setStatus(ExecutionStepLog.Status.RUNNING);
                stepLog.setStartedAt(Instant.now());

                // Resolve variables context and set input payload BEFORE saving status and notifying frontend
                Map<String, Object> configMap = Map.of();
                try {
                    String resolvedConfig = VariableInterpolator.resolveJson(step.getConfig(), context);
                    configMap = parseConfig(resolvedConfig);
                    stepLog.setInputPayload(objectMapper.writeValueAsString(configMap));
                } catch (Exception e) {
                    try {
                        stepLog.setInputPayload(step.getConfig() != null ? step.getConfig() : "{}");
                        configMap = parseConfig(step.getConfig() != null ? step.getConfig() : "{}");
                    } catch (Exception ex) {
                        // ignore
                    }
                }
                stepLogRepository.save(stepLog);
                eventPublisher.publishEvent(new ExecutionUpdateEvent(executionId));

                long stepStart = System.currentTimeMillis();
                try {

                    // Execute the step based on type
                    StepResult result = executeStep(step, configMap, context);

                    stepLog.setOutputPayload(objectMapper.writeValueAsString(result.output()));
                    stepLog.setStatus(result.passed() ? ExecutionStepLog.Status.PASSED : ExecutionStepLog.Status.FAILED);

                    if (!result.passed()) {
                        stepLog.setErrorMessage(result.errorMessage());
                        failedSteps++;
                        boolean soft = false;
                        if (configMap != null && configMap.containsKey("softAssertion")) {
                            Object softObj = configMap.get("softAssertion");
                            if (softObj instanceof Boolean b) soft = b;
                            else if (softObj instanceof String s) soft = Boolean.parseBoolean(s);
                        }
                        if (!soft) {
                            aborted = true; // Stop on first failure unless soft assertion is enabled
                        }
                    } else {
                        passedSteps++;
                        // If SET_VARIABLE step, add extracted value to context
                        if (step.getStepType() == TestStep.StepType.SET_VARIABLE && result.extractedVariables() != null) {
                            for (StepResult.ExtractedVariable v : result.extractedVariables()) {
                                setContextVariable(v.key(), v.value(), context);
                            }
                        }

                        // Check for embedded variables on non-SetVariable steps
                        if (step.getStepType() != TestStep.StepType.SET_VARIABLE && configMap.containsKey("variables")) {
                            StepExecutor varExec = executorMap.get(TestStep.StepType.SET_VARIABLE);
                            if (varExec != null) {
                                StepResult varRes = varExec.execute(step, configMap, context);
                                if (varRes.passed() && varRes.extractedVariables() != null) {
                                    for (StepResult.ExtractedVariable v : varRes.extractedVariables()) {
                                        setContextVariable(v.key(), v.value(), context);
                                    }
                                    if (result.output() instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> mutOutput = (Map<String, Object>) result.output();
                                        mutOutput.put("embeddedVariables", varRes.output());
                                    }
                                }
                            }
                        }

                        // Check for embedded assertions on non-Assertion steps
                        if (step.getStepType() != TestStep.StepType.ASSERTION && configMap.containsKey("assertions")) {
                            Object assertionsObj = configMap.get("assertions");
                            if (assertionsObj instanceof List<?> assertionsList) {
                                StepExecutor assertExec = executorMap.get(TestStep.StepType.ASSERTION);
                                if (assertExec != null) {
                                    List<Map<String, Object>> assertionResults = new java.util.ArrayList<>();
                                    boolean allAssertionsPassed = true;
                                    StringBuilder assertErrorMsg = new StringBuilder();

                                    for (Object assertItem : assertionsList) {
                                        if (assertItem instanceof Map<?, ?> mapItem) {
                                            @SuppressWarnings("unchecked")
                                            Map<String, Object> assertMap = (Map<String, Object>) mapItem;
                                            
                                            StepResult assertRes = assertExec.execute(step, assertMap, context);
                                            assertionResults.add(assertRes.output());
                                            
                                            if (!assertRes.passed()) {
                                                allAssertionsPassed = false;
                                                if (assertErrorMsg.length() > 0) assertErrorMsg.append("; ");
                                                assertErrorMsg.append(assertRes.errorMessage());
                                            }
                                        }
                                    }

                                    if (result.output() instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> mutOutput = (Map<String, Object>) result.output();
                                        mutOutput.put("embeddedAssertions", assertionResults);
                                    }

                                    if (!allAssertionsPassed) {
                                        // Override the main step result to failed
                                        result = StepResult.failed("Embedded assertion failed: " + assertErrorMsg.toString(), result.output());
                                        stepLog.setStatus(ExecutionStepLog.Status.FAILED);
                                        stepLog.setErrorMessage(result.errorMessage());
                                        failedSteps++;
                                        passedSteps--; // Rollback the pass count
                                        aborted = true;
                                    }
                                }
                            }
                        }

                        // Handle branching/jumping
                        if (result.nextStepSequenceOrder() != null) {
                            int targetOrder = result.nextStepSequenceOrder();
                            // Find the index of the step with target sequence order
                            int targetIndex = -1;
                            for (int j = 0; j < steps.size(); j++) {
                                if (steps.get(j).getSequenceOrder() == targetOrder) {
                                    targetIndex = j;
                                    break;
                                }
                            }
                            if (targetIndex != -1) {
                                i = targetIndex;
                                stepLog.setCompletedAt(Instant.now());
                                stepLog.setDurationMs(System.currentTimeMillis() - stepStart);
                                stepLogRepository.save(stepLog);
                                eventPublisher.publishEvent(new ExecutionUpdateEvent(executionId));
                                continue; // skip the i++ at the bottom of the loop
                            } else {
                                log.warn("Jump target sequence order {} not found in test case steps", targetOrder);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("Step execution error for step {}: {}", step.getId(), e.getMessage(), e);
                    stepLog.setStatus(ExecutionStepLog.Status.FAILED);
                    stepLog.setErrorMessage("Unexpected error: " + e.getMessage());
                    failedSteps++;
                    aborted = true;
                }

                stepLog.setCompletedAt(Instant.now());
                stepLog.setDurationMs(System.currentTimeMillis() - stepStart);
                stepLogRepository.save(stepLog);
                eventPublisher.publishEvent(new ExecutionUpdateEvent(executionId));
                i++;
            }

            // Finalize execution
            execution.setCompletedAt(Instant.now());
            execution.setPassedSteps(passedSteps);
            execution.setFailedSteps(failedSteps);

            long startMs = execution.getStartedAt() != null
                    ? execution.getStartedAt().toEpochMilli() : System.currentTimeMillis();
            execution.setDurationMs(System.currentTimeMillis() - startMs);

            if (failedSteps == 0) {
                execution.setStatus(Execution.Status.PASSED);
            } else {
                execution.setStatus(Execution.Status.FAILED);
            }
            executionRepository.save(execution);
            eventPublisher.publishEvent(new ExecutionUpdateEvent(executionId));

            if (execution.getStatus() == Execution.Status.FAILED || execution.getStatus() == Execution.Status.ERROR) {
                try {
                    String userId = execution.getTriggeredBy();
                    if (userId != null && !userId.equals("SYSTEM") && !userId.equals("SYSTEM_SCHEDULER")) {
                        userRepository.findById(userId).ifPresent(user -> {
                            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                                log.info("Triggering automatic failure email report for execution {} to {}", executionId, user.getEmail());
                                reportService.sendExecutionReport(executionId, user.getEmail());
                            }
                        });
                    }
                } catch (Exception e) {
                    log.error("Failed to send automatic execution alert email: {}", e.getMessage(), e);
                }
            }

            // Release pooled database connections for this execution
            try {
                connectionPool.closeConnections(executionId);
            } catch (Exception e) {
                log.error("Error closing connection pool for execution {}: {}", executionId, e.getMessage());
            }

            // Release pooled mainframe connections for this execution
            try {
                mainframeSessionPool.closeSessions(executionId);
            } catch (Exception e) {
                log.error("Error closing mainframe session pool for execution {}: {}", executionId, e.getMessage());
            }

            log.info("Execution {} completed: {} — {}/{} steps passed",
                    executionId, execution.getStatus(), passedSteps, steps.size());
        } finally {
            org.slf4j.MDC.clear();
        }
    }

    public StepResult executeStep(TestStep step, Map<String, Object> config, Map<String, String> context) {
        StepExecutor executor = executorMap.get(step.getStepType());
        if (executor != null) {
            int timeoutMs = 60000; // default 60s
            int retryCount = 0;
            long retryDelayMs = 1000;

            if (config != null) {
                if (config.containsKey("timeoutMs")) {
                    Object toObj = config.get("timeoutMs");
                    if (toObj instanceof Number num) timeoutMs = num.intValue();
                    else if (toObj instanceof String str) {
                        try { timeoutMs = Integer.parseInt(str); } catch (NumberFormatException e) { }
                    }
                }
                if (config.containsKey("retries")) {
                    Object rcObj = config.get("retries");
                    if (rcObj instanceof Number num) retryCount = num.intValue();
                    else if (rcObj instanceof String str) {
                        try { retryCount = Integer.parseInt(str); } catch (NumberFormatException e) { }
                    }
                } else if (config.containsKey("retryCount")) {
                    Object rcObj = config.get("retryCount");
                    if (rcObj instanceof Number num) retryCount = num.intValue();
                    else if (rcObj instanceof String str) {
                        try { retryCount = Integer.parseInt(str); } catch (NumberFormatException e) { }
                    }
                }
                if (config.containsKey("retryIntervalMs")) {
                    Object rdObj = config.get("retryIntervalMs");
                    if (rdObj instanceof Number num) retryDelayMs = num.longValue();
                    else if (rdObj instanceof String str) {
                        try { retryDelayMs = Long.parseLong(str); } catch (NumberFormatException e) { }
                    }
                } else if (config.containsKey("retryDelayMs")) {
                    Object rdObj = config.get("retryDelayMs");
                    if (rdObj instanceof Number num) retryDelayMs = num.longValue();
                    else if (rdObj instanceof String str) {
                        try { retryDelayMs = Long.parseLong(str); } catch (NumberFormatException e) { }
                    }
                }
            }

            final int finalTimeout = timeoutMs;
            final int finalRetryCount = retryCount;
            final long finalRetryDelayMs = retryDelayMs;

            StepResult result = null;
            int attempt = 0;

            try (var stepExecutorService = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                while (attempt <= finalRetryCount) {
                    if (attempt > 0) {
                        log.info("Retrying step '{}' (attempt {} of {}) after {}ms", step.getName(), attempt, finalRetryCount, finalRetryDelayMs);
                        try {
                            Thread.sleep(finalRetryDelayMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            result = StepResult.failed("Execution interrupted during retry delay", Map.of());
                            break;
                        }
                    }

                    final int currentAttempt = attempt;
                    final Map<String, String> mdcContext = org.slf4j.MDC.getCopyOfContextMap();
                    
                    java.util.concurrent.Future<StepResult> future = stepExecutorService.submit(() -> {
                        if (mdcContext != null) {
                            org.slf4j.MDC.setContextMap(mdcContext);
                        }
                        try {
                            return executor.execute(step, config, context);
                        } finally {
                            org.slf4j.MDC.clear();
                        }
                    });

                    try {
                        result = future.get(finalTimeout, java.util.concurrent.TimeUnit.MILLISECONDS);

                        if (result != null && step.getStepType() == TestStep.StepType.DB_TABLE_VIEW) {
                            // Inject tableTitle from config into output for frontend rendering
                            String tableTitle = (String) config.get("tableTitle");
                            if (tableTitle != null && !tableTitle.isBlank()) {
                                Map<String, Object> enrichedOutput = new java.util.LinkedHashMap<>(result.output() != null ? result.output() : Map.of());
                                enrichedOutput.put("tableTitle", tableTitle);
                                result = new StepResult(result.passed(), enrichedOutput, result.errorMessage(), result.extractedVariables(), result.nextStepSequenceOrder());
                            }
                        }

                        if (result != null && result.passed()) {
                            break;
                        }
                    } catch (java.util.concurrent.TimeoutException te) {
                        future.cancel(true);
                        log.warn("Step '{}' timed out after {}ms (attempt {})", step.getName(), finalTimeout, currentAttempt);
                        result = StepResult.failed(String.format("Step execution timed out after %d ms", finalTimeout), Map.of());
                    } catch (java.util.concurrent.ExecutionException ee) {
                        Throwable cause = ee.getCause();
                        log.error("Execution exception in step '{}' (attempt {}): {}", step.getName(), currentAttempt, cause != null ? cause.getMessage() : ee.getMessage());
                        result = StepResult.failed("Execution error: " + (cause != null ? cause.getMessage() : ee.getMessage()), Map.of());
                    } catch (Exception e) {
                        log.error("Unexpected error executing step '{}' (attempt {}): {}", step.getName(), currentAttempt, e.getMessage(), e);
                        result = StepResult.failed("Unexpected error: " + e.getMessage(), Map.of());
                    }

                    attempt++;
                }
            }

            return result != null ? result : StepResult.failed("Unknown error during execution", Map.of());
        }

        return switch (step.getStepType()) {
            case PARALLEL -> executeParallel(step, config, context);
            case GLOBAL_REF -> StepResult.passed(Map.of("info", "Global step ref resolved"));
            default -> StepResult.passed(Map.of("info", "Step type not yet implemented: " + step.getStepType()));
        };
    }

    private StepResult executeParallel(TestStep step, Map<String, Object> config, Map<String, String> context) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> subSteps = (List<Map<String, Object>>) config.getOrDefault("steps", List.of());
        if (subSteps.isEmpty()) {
            return StepResult.passed(Map.of("message", "No parallel steps to execute"));
        }

        // Use thread-safe context for parallel execution
        Map<String, String> safeContext = new java.util.concurrent.ConcurrentHashMap<>(context);

        var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor();
        List<java.util.concurrent.Future<Map<String, Object>>> futures = new java.util.ArrayList<>();

        for (int i = 0; i < subSteps.size(); i++) {
            final int index = i;
            final Map<String, Object> subStepMap = subSteps.get(i);
            futures.add(executor.submit(() -> {
                String subName = (String) subStepMap.getOrDefault("name", "Sub-step " + (index + 1));
                String subTypeStr = (String) subStepMap.getOrDefault("stepType", "LOG");
                @SuppressWarnings("unchecked")
                Map<String, Object> subConfig = (Map<String, Object>) subStepMap.getOrDefault("config", Map.of());

                TestStep dummyStep = new TestStep();
                dummyStep.setTestCaseId(step.getTestCaseId());
                dummyStep.setSequenceOrder(index + 1);
                dummyStep.setName(subName);
                dummyStep.setStepType(TestStep.StepType.valueOf(subTypeStr));
                try {
                    dummyStep.setConfig(objectMapper.writeValueAsString(subConfig));
                } catch (Exception e) {
                    dummyStep.setConfig("{}");
                }

                Map<String, Object> stepResultLog = new LinkedHashMap<>();
                stepResultLog.put("name", subName);
                stepResultLog.put("stepType", subTypeStr);

                long start = System.currentTimeMillis();
                try {
                    // Resolve variable interpolation in sub-step config
                    String resolvedConfig = com.axon.orion.common.util.VariableInterpolator.resolveJson(
                            objectMapper.writeValueAsString(subConfig), safeContext);
                    Map<String, Object> resolvedConfigMap = parseConfig(resolvedConfig);

                    StepResult result = executeStep(dummyStep, resolvedConfigMap, safeContext);
                    
                    stepResultLog.put("passed", result.passed());
                    stepResultLog.put("durationMs", System.currentTimeMillis() - start);
                    stepResultLog.put("output", result.output());
                    if (!result.passed()) {
                        stepResultLog.put("errorMessage", result.errorMessage());
                    } else {
                        // Check for embedded variables on non-SetVariable steps
                        if (dummyStep.getStepType() != TestStep.StepType.SET_VARIABLE && resolvedConfigMap.containsKey("variables")) {
                            StepExecutor varExec = executorMap.get(TestStep.StepType.SET_VARIABLE);
                            if (varExec != null) {
                                StepResult varRes = varExec.execute(dummyStep, resolvedConfigMap, safeContext);
                                if (varRes.passed() && varRes.extractedVariables() != null) {
                                    for (StepResult.ExtractedVariable v : varRes.extractedVariables()) {
                                        setContextVariable(v.key(), v.value(), safeContext);
                                    }
                                    if (result.output() instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> mutOutput = (Map<String, Object>) result.output();
                                        mutOutput.put("embeddedVariables", varRes.output());
                                    }
                                }
                            }
                        } else if (dummyStep.getStepType() == TestStep.StepType.SET_VARIABLE && result.extractedVariables() != null) {
                            for (StepResult.ExtractedVariable v : result.extractedVariables()) {
                                setContextVariable(v.key(), v.value(), safeContext);
                            }
                        }

                        // Check for embedded assertions on non-Assertion steps
                        if (dummyStep.getStepType() != TestStep.StepType.ASSERTION && resolvedConfigMap.containsKey("assertions")) {
                            Object assertionsObj = resolvedConfigMap.get("assertions");
                            if (assertionsObj instanceof List<?> assertionsList) {
                                StepExecutor assertExec = executorMap.get(TestStep.StepType.ASSERTION);
                                if (assertExec != null) {
                                    List<Map<String, Object>> assertionResults = new java.util.ArrayList<>();
                                    boolean allAssertionsPassed = true;
                                    StringBuilder assertErrorMsg = new StringBuilder();

                                    for (Object assertItem : assertionsList) {
                                        if (assertItem instanceof Map<?, ?> mapItem) {
                                            @SuppressWarnings("unchecked")
                                            Map<String, Object> assertMap = (Map<String, Object>) mapItem;
                                            
                                            StepResult assertRes = assertExec.execute(dummyStep, assertMap, safeContext);
                                            assertionResults.add(assertRes.output());
                                            
                                            if (!assertRes.passed()) {
                                                allAssertionsPassed = false;
                                                if (assertErrorMsg.length() > 0) assertErrorMsg.append("; ");
                                                assertErrorMsg.append(assertRes.errorMessage());
                                            }
                                        }
                                    }

                                    if (result.output() instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> mutOutput = (Map<String, Object>) result.output();
                                        mutOutput.put("embeddedAssertions", assertionResults);
                                    }

                                    if (!allAssertionsPassed) {
                                        result = StepResult.failed("Embedded assertion failed: " + assertErrorMsg.toString(), result.output());
                                        stepResultLog.put("passed", false);
                                        stepResultLog.put("errorMessage", result.errorMessage());
                                    }
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    stepResultLog.put("passed", false);
                    stepResultLog.put("durationMs", System.currentTimeMillis() - start);
                    stepResultLog.put("errorMessage", "Error: " + e.getMessage());
                }
                return stepResultLog;
            }));
        }

        List<Map<String, Object>> subStepResults = new java.util.ArrayList<>();
        boolean allPassed = true;
        StringBuilder errorMsg = new StringBuilder();

        for (var future : futures) {
            try {
                Map<String, Object> res = future.get();
                subStepResults.add(res);
                boolean passed = (boolean) res.getOrDefault("passed", false);
                if (!passed) {
                    allPassed = false;
                    if (errorMsg.length() > 0) errorMsg.append("; ");
                    errorMsg.append(res.get("name")).append(" failed: ").append(res.get("errorMessage"));
                }
            } catch (Exception e) {
                allPassed = false;
                if (errorMsg.length() > 0) errorMsg.append("; ");
                errorMsg.append("Thread execution error: ").append(e.getMessage());
            }
        }

        // Merge thread-safe context back into parent context
        context.putAll(safeContext);

        executor.shutdown();

        Map<String, Object> output = Map.of("subStepLogs", subStepResults);
        if (allPassed) {
            return StepResult.passed(output);
        } else {
            return StepResult.failed(errorMsg.toString(), output);
        }
    }



    public void setContextVariable(String key, String value, Map<String, String> context) {
        context.put(key, value);
        try {
            globalEnvConfigRepository.findByConfigKey(key).ifPresent(cfg -> {
                cfg.setConfigValue(value);
                globalEnvConfigRepository.save(cfg);
                log.info("Persistently updated global env config: {} = {}", key, value);
            });
        } catch (Exception e) {
            log.error("Failed to persistently update global env config for key {}: {}", key, e.getMessage());
        }
    }

    private ExecutionStepLog createStepLog(String executionId, com.axon.orion.testcase.entity.TestStep step) {
        ExecutionStepLog log = new ExecutionStepLog();
        log.setExecutionId(executionId);
        log.setTestStepId(step.getId());
        log.setSequenceOrder(step.getSequenceOrder());
        log.setStepName(step.getName());
        log.setStepType(step.getStepType() != null ? step.getStepType().name() : null);
        log.setStatus(ExecutionStepLog.Status.PENDING);
        return log;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> parseConfig(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
