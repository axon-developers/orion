package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;

import java.util.List;
import java.util.Map;

/**
 * Result of executing a single test step.
 */
public record StepResult(
        boolean passed,
        Map<String, Object> output,
        String errorMessage,
        List<ExtractedVariable> extractedVariables,
        Integer nextStepSequenceOrder
) {
    public record ExtractedVariable(String key, String value) {}

    public static StepResult passed(Map<String, Object> output) {
        return new StepResult(true, output, null, null, null);
    }

    public static StepResult failed(String errorMessage, Map<String, Object> output) {
        return new StepResult(false, output, errorMessage, null, null);
    }

    public static StepResult withVariable(String key, String value, Map<String, Object> output) {
        return new StepResult(true, output, null, List.of(new ExtractedVariable(key, value)), null);
    }

    public static StepResult withVariables(List<ExtractedVariable> vars, Map<String, Object> output) {
        return new StepResult(true, output, null, vars, null);
    }

    public static StepResult jump(int nextStepSequenceOrder, Map<String, Object> output) {
        return new StepResult(true, output, null, null, nextStepSequenceOrder);
    }
}
