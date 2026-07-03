package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;

import java.util.Map;

/**
 * Result of executing a single test step.
 */
public record StepResult(
        boolean passed,
        Map<String, Object> output,
        String errorMessage,
        ExtractedVariable extractedVariable
) {
    public record ExtractedVariable(String key, String value) {}

    public static StepResult passed(Map<String, Object> output) {
        return new StepResult(true, output, null, null);
    }

    public static StepResult failed(String errorMessage, Map<String, Object> output) {
        return new StepResult(false, output, errorMessage, null);
    }

    public static StepResult withVariable(String key, String value, Map<String, Object> output) {
        return new StepResult(true, output, null, new ExtractedVariable(key, value));
    }
}
