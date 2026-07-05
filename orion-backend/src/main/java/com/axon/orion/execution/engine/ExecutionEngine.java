package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ExecutionEngine {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestStepRepository testStepRepository;
    private final ObjectMapper objectMapper;
    private final ExecutionConnectionPool connectionPool;

    // Step executor registry
    private final Map<TestStep.StepType, StepExecutor> executorMap = new HashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public ExecutionEngine(
            ExecutionRepository executionRepository,
            ExecutionStepLogRepository stepLogRepository,
            TestStepRepository testStepRepository,
            ObjectMapper objectMapper,
            List<StepExecutor> executors,
            ExecutionConnectionPool connectionPool
    ) {
        this.executionRepository = executionRepository;
        this.stepLogRepository = stepLogRepository;
        this.testStepRepository = testStepRepository;
        this.objectMapper = objectMapper;
        this.connectionPool = connectionPool;
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

        org.slf4j.MDC.put("executionId", executionId);
        org.slf4j.MDC.put("testCaseId", execution.getTestCaseId());

        try {
            // Status → RUNNING
            execution.setStatus(Execution.Status.RUNNING);
            execution.setStartedAt(Instant.now());
            executionRepository.save(execution);

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
                    ExecutionStepLog skipped = createStepLog(executionId, step.getId(), step.getSequenceOrder());
                    skipped.setStatus(ExecutionStepLog.Status.SKIPPED);
                    skipped.setDurationMs(0L);
                    skipped.setErrorMessage("Step is disabled");
                    stepLogRepository.save(skipped);
                    i++;
                    continue;
                }

                if (aborted) {
                    // Log remaining steps as SKIPPED
                    ExecutionStepLog skipped = createStepLog(executionId, step.getId(), step.getSequenceOrder());
                    skipped.setStatus(ExecutionStepLog.Status.SKIPPED);
                    stepLogRepository.save(skipped);
                    i++;
                    continue;
                }

                ExecutionStepLog stepLog = createStepLog(executionId, step.getId(), step.getSequenceOrder());
                stepLog.setStatus(ExecutionStepLog.Status.RUNNING);
                stepLog.setStartedAt(Instant.now());
                stepLogRepository.save(stepLog);

                long stepStart = System.currentTimeMillis();
                try {
                    // Resolve variable interpolation in step config
                    String resolvedConfig = VariableInterpolator.resolveJson(step.getConfig(), context);
                    Map<String, Object> configMap = parseConfig(resolvedConfig);

                    stepLog.setInputPayload(objectMapper.writeValueAsString(configMap));

                    // Execute the step based on type
                    StepResult result = executeStep(step, configMap, context);

                    stepLog.setOutputPayload(objectMapper.writeValueAsString(result.output()));
                    stepLog.setStatus(result.passed() ? ExecutionStepLog.Status.PASSED : ExecutionStepLog.Status.FAILED);

                    if (!result.passed()) {
                        stepLog.setErrorMessage(result.errorMessage());
                        failedSteps++;
                        aborted = true; // Stop on first failure (configurable future)
                    } else {
                        passedSteps++;
                        // If SET_VARIABLE step, add extracted value to context
                        if (step.getStepType() == TestStep.StepType.SET_VARIABLE && result.extractedVariable() != null) {
                            context.put(result.extractedVariable().key(), result.extractedVariable().value());
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

            // Release pooled database connections for this execution
            try {
                connectionPool.closeConnections(executionId);
            } catch (Exception e) {
                log.error("Error closing connection pool for execution {}: {}", executionId, e.getMessage());
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
            StepResult result = executor.execute(step, config, context);
            if (step.getStepType() == TestStep.StepType.DB_TABLE_VIEW) {
                // Inject tableTitle from config into output for frontend rendering
                String tableTitle = (String) config.get("tableTitle");
                if (tableTitle != null && !tableTitle.isBlank()) {
                    Map<String, Object> enrichedOutput = new java.util.LinkedHashMap<>(result.output() != null ? result.output() : Map.of());
                    enrichedOutput.put("tableTitle", tableTitle);
                    return new StepResult(result.passed(), enrichedOutput, result.errorMessage(), result.extractedVariable(), result.nextStepSequenceOrder());
                }
            }
            return result;
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
                    } else if (dummyStep.getStepType() == TestStep.StepType.SET_VARIABLE && result.extractedVariable() != null) {
                        safeContext.put(result.extractedVariable().key(), result.extractedVariable().value());
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



    private ExecutionStepLog createStepLog(String executionId, String testStepId, int order) {
        ExecutionStepLog log = new ExecutionStepLog();
        log.setExecutionId(executionId);
        log.setTestStepId(testStepId);
        log.setSequenceOrder(order);
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
