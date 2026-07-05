package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import java.util.Map;
import java.util.Set;

public interface StepExecutor {
    StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context);
    Set<TestStep.StepType> supportedTypes();
}
