package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class LoopExecutor implements StepExecutor {

    @Autowired @Lazy
    private ExecutionEngine executionEngine;

    @Autowired
    private TestStepRepository testStepRepository;

    @Autowired
    private ExecutionStepLogRepository stepLogRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.LOOP);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String loopType = (String) config.getOrDefault("type", "COUNT");
        String iteratorVar = (String) config.getOrDefault("iteratorVariable", "item");

        @SuppressWarnings("unchecked")
        List<Number> stepOrders = (List<Number>) config.get("steps");
        if (stepOrders == null || stepOrders.isEmpty()) {
            return StepResult.passed(Map.of("message", "No steps configured to repeat in loop"));
        }

        // Fetch all steps for this test case
        List<TestStep> allSteps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(step.getTestCaseId());

        // Filter the ones in the loop
        Set<Integer> targetOrders = stepOrders.stream().map(Number::intValue).collect(Collectors.toSet());
        List<TestStep> loopSteps = allSteps.stream()
                .filter(s -> targetOrders.contains(s.getSequenceOrder()))
                .toList();

        if (loopSteps.isEmpty()) {
            return StepResult.passed(Map.of("message", "None of the configured loop steps were found"));
        }

        // Record the skipped steps in context so ExecutionEngine skips them in outer loop
        String skippedStr = targetOrders.stream().map(String::valueOf).collect(Collectors.joining(","));
        context.put("__skippedStepOrders", skippedStr);

        int iterations = 1;
        List<Object> items = new ArrayList<>();

        if ("COUNT".equalsIgnoreCase(loopType)) {
            iterations = ((Number) config.getOrDefault("count", 1)).intValue();
            for (int i = 0; i < iterations; i++) {
                items.add(i + 1); // just loop counter
            }
        } else if ("FOR_EACH".equalsIgnoreCase(loopType)) {
            String dataSource = (String) config.get("dataSource");
            if (dataSource != null && !dataSource.isBlank()) {
                try {
                    String resolvedSource = VariableInterpolator.resolve(dataSource, context);
                    Object parsedData = null;
                    if (resolvedSource.startsWith("$")) {
                        // JSONPath on last response body
                        String responseBody = context.getOrDefault("__lastResponseBody", "{}");
                        parsedData = JsonPath.read(responseBody, resolvedSource);
                    } else {
                        // Direct variable lookup
                        String val = context.get(resolvedSource);
                        if (val != null) {
                            parsedData = objectMapper.readValue(val, Object.class);
                        }
                    }

                    if (parsedData instanceof Collection<?> col) {
                        items.addAll(col);
                    } else if (parsedData instanceof Object[] arr) {
                        items.addAll(Arrays.asList(arr));
                    } else if (parsedData != null) {
                        items.add(parsedData);
                    }
                } catch (Exception e) {
                    log.error("Failed to parse loop data source {}: {}", dataSource, e.getMessage());
                    return StepResult.failed("Failed to parse loop data source: " + e.getMessage(), Map.of());
                }
            }
            iterations = items.size();
        }

        boolean allPassed = true;
        String firstFailureMessage = null;

        String oldLoopIndex = context.get("__loopIndex");
        String oldIterationIndex = context.get("__iterationIndex");

        for (int iter = 0; iter < items.size(); iter++) {
            Object currentItem = items.get(iter);

            context.put("__loopIndex", String.valueOf(iter));
            context.put("__iterationIndex", String.valueOf(iter));

            // Put iterator variable in context
            try {
                String itemStr = currentItem instanceof String s ? s : objectMapper.writeValueAsString(currentItem);
                context.put(iteratorVar, itemStr);
            } catch (Exception e) {
                context.put(iteratorVar, String.valueOf(currentItem));
            }

            for (TestStep loopStep : loopSteps) {
                if (!loopStep.isEnabled()) continue;

                // Execute the step using executionEngine
                ExecutionStepLog stepLog = new ExecutionStepLog();
                stepLog.setExecutionId(context.get("__executionId"));
                stepLog.setTestStepId(loopStep.getId());
                stepLog.setSequenceOrder(loopStep.getSequenceOrder());
                stepLog.setStatus(ExecutionStepLog.Status.RUNNING);
                stepLog.setStartedAt(Instant.now());
                stepLogRepository.save(stepLog);

                long start = System.currentTimeMillis();
                try {
                    String resolvedConfig = VariableInterpolator.resolveJson(loopStep.getConfig(), context);
                    Map<String, Object> configMap = executionEngine.parseConfig(resolvedConfig);

                    stepLog.setInputPayload(objectMapper.writeValueAsString(configMap));

                    StepResult result = executionEngine.executeStep(loopStep, configMap, context);

                    stepLog.setOutputPayload(objectMapper.writeValueAsString(result.output()));

                    if (!result.passed()) {
                        stepLog.setStatus(ExecutionStepLog.Status.FAILED);
                        stepLog.setErrorMessage(result.errorMessage());
                        allPassed = false;
                        if (firstFailureMessage == null) {
                            firstFailureMessage = String.format("Step '%s' failed in iteration %d: %s", loopStep.getName(), iter + 1, result.errorMessage());
                        }
                        break;
                    } else {
                        stepLog.setStatus(ExecutionStepLog.Status.PASSED);
                        if (loopStep.getStepType() == TestStep.StepType.SET_VARIABLE && result.extractedVariables() != null) {
                            for (StepResult.ExtractedVariable v : result.extractedVariables()) {
                                executionEngine.setContextVariable(v.key(), v.value(), context);
                            }
                        }
                    }
                } catch (Exception e) {
                    stepLog.setStatus(ExecutionStepLog.Status.FAILED);
                    stepLog.setErrorMessage(e.getMessage());
                    allPassed = false;
                    if (firstFailureMessage == null) {
                        firstFailureMessage = String.format("Step '%s' failed with error in iteration %d: %s", loopStep.getName(), iter + 1, e.getMessage());
                    }
                    break;
                } finally {
                    stepLog.setCompletedAt(Instant.now());
                    stepLog.setDurationMs(System.currentTimeMillis() - start);
                    stepLogRepository.save(stepLog);
                }
            }
            if (!allPassed) {
                break;
            }
        }

        // Clean up iterator variable
        context.remove(iteratorVar);

        if (oldLoopIndex != null) {
            context.put("__loopIndex", oldLoopIndex);
        } else {
            context.remove("__loopIndex");
        }
        if (oldIterationIndex != null) {
            context.put("__iterationIndex", oldIterationIndex);
        } else {
            context.remove("__iterationIndex");
        }

        Map<String, Object> output = Map.of(
                "loopType", loopType,
                "iterationsRun", items.size(),
                "allPassed", allPassed
        );

        if (allPassed) {
            return StepResult.passed(output);
        } else {
            return StepResult.failed(firstFailureMessage, output);
        }
    }
}
