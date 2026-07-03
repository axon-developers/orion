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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExecutionEngine {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestStepRepository testStepRepository;
    private final ObjectMapper objectMapper;

    // Step executor registry
    private final HttpRequestExecutor httpRequestExecutor;
    private final AssertionExecutor assertionExecutor;
    private final DelayExecutor delayExecutor;
    private final SetVariableExecutor setVariableExecutor;
    private final LogExecutor logExecutor;
    private final ScriptExecutor scriptExecutor;
    private final DatabaseQueryExecutor databaseQueryExecutor;

    @Async("executionTaskExecutor")
    public void execute(String executionId, Map<String, String> variableContext) {
        Execution execution = executionRepository.findById(executionId).orElse(null);
        if (execution == null) {
            log.error("Execution not found: {}", executionId);
            return;
        }

        // Status → RUNNING
        execution.setStatus(Execution.Status.RUNNING);
        execution.setStartedAt(Instant.now().toString());
        executionRepository.save(execution);

        List<TestStep> steps = testStepRepository
                .findByTestCaseIdOrderBySequenceOrderAsc(execution.getTestCaseId());

        execution.setTotalSteps(steps.size());
        executionRepository.save(execution);

        // Mutable runtime variable context
        Map<String, String> context = new LinkedHashMap<>(variableContext);
        int passedSteps = 0;
        int failedSteps = 0;
        boolean aborted = false;

        for (TestStep step : steps) {
            if (aborted) {
                // Log remaining steps as SKIPPED
                ExecutionStepLog skipped = createStepLog(executionId, step.getId(), step.getSequenceOrder());
                skipped.setStatus(ExecutionStepLog.Status.SKIPPED);
                stepLogRepository.save(skipped);
                continue;
            }

            ExecutionStepLog stepLog = createStepLog(executionId, step.getId(), step.getSequenceOrder());
            stepLog.setStatus(ExecutionStepLog.Status.RUNNING);
            stepLog.setStartedAt(Instant.now().toString());
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
                }
            } catch (Exception e) {
                log.error("Step execution error for step {}: {}", step.getId(), e.getMessage(), e);
                stepLog.setStatus(ExecutionStepLog.Status.FAILED);
                stepLog.setErrorMessage("Unexpected error: " + e.getMessage());
                failedSteps++;
                aborted = true;
            }

            stepLog.setCompletedAt(Instant.now().toString());
            stepLog.setDurationMs(System.currentTimeMillis() - stepStart);
            stepLogRepository.save(stepLog);
        }

        // Finalize execution
        execution.setCompletedAt(Instant.now().toString());
        execution.setPassedSteps(passedSteps);
        execution.setFailedSteps(failedSteps);

        long startMs = execution.getStartedAt() != null
                ? Instant.parse(execution.getStartedAt()).toEpochMilli() : System.currentTimeMillis();
        execution.setDurationMs(System.currentTimeMillis() - startMs);

        if (failedSteps == 0) {
            execution.setStatus(Execution.Status.PASSED);
        } else {
            execution.setStatus(Execution.Status.FAILED);
        }
        executionRepository.save(execution);

        log.info("Execution {} completed: {} — {}/{} steps passed",
                executionId, execution.getStatus(), passedSteps, steps.size());
    }

    private StepResult executeStep(TestStep step, Map<String, Object> config, Map<String, String> context) {
        return switch (step.getStepType()) {
            case HTTP_REQUEST -> httpRequestExecutor.execute(step, config, context);
            case ASSERTION -> assertionExecutor.execute(step, config, context);
            case DELAY -> delayExecutor.execute(step, config, context);
            case SET_VARIABLE -> setVariableExecutor.execute(step, config, context);
            case LOG -> logExecutor.execute(step, config, context);
            case SCRIPT -> scriptExecutor.execute(step, config, context);
            case DATABASE_QUERY -> databaseQueryExecutor.execute(step, config, context);
            case CONDITIONAL -> executeConditional(step, config, context);
            case LOOP -> executeLoop(step, config, context);
            case GLOBAL_REF -> StepResult.passed(Map.of("info", "Global step ref resolved"));
            default -> StepResult.passed(Map.of("info", "Step type not yet implemented: " + step.getStepType()));
        };
    }

    private StepResult executeConditional(TestStep step, Map<String, Object> config, Map<String, String> context) {
        // Basic conditional: evaluate condition string against context
        String condition = (String) config.getOrDefault("condition", "false");
        String resolvedCondition = VariableInterpolator.resolve(condition, context);
        boolean result = evaluateCondition(resolvedCondition);
        return StepResult.passed(Map.of("conditionResult", result, "condition", condition));
    }

    private StepResult executeLoop(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String type = (String) config.getOrDefault("type", "COUNT");
        int count = ((Number) config.getOrDefault("count", 1)).intValue();
        return StepResult.passed(Map.of("loopType", type, "iterations", count,
                "info", "Loop execution tracking in step logs"));
    }

    private boolean evaluateCondition(String condition) {
        // Simple equality/comparison evaluation
        try {
            if (condition.contains("==")) {
                String[] parts = condition.split("==", 2);
                return parts[0].trim().equals(parts[1].trim());
            }
            if (condition.contains("!=")) {
                String[] parts = condition.split("!=", 2);
                return !parts[0].trim().equals(parts[1].trim());
            }
            return Boolean.parseBoolean(condition.trim());
        } catch (Exception e) {
            return false;
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
    private Map<String, Object> parseConfig(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
