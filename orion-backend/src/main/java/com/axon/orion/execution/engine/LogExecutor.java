package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class LogExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.LOG);
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String message = VariableInterpolator.resolve((String) config.getOrDefault("message", ""), context);
        String level = (String) config.getOrDefault("level", "INFO");

        switch (level.toUpperCase()) {
            case "DEBUG" -> log.debug("[ORION-LOG] {}", message);
            case "WARN" -> log.warn("[ORION-LOG] {}", message);
            default -> log.info("[ORION-LOG] {}", message);
        }

        return StepResult.passed(Map.of("message", message, "level", level));
    }
}
