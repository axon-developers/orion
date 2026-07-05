package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class ConditionalExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.CONDITIONAL);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String condition = (String) config.getOrDefault("condition", "false");
        String resolvedCondition = VariableInterpolator.resolve(condition, context);
        boolean conditionPassed = evaluateCondition(resolvedCondition);

        Integer targetSequenceOrder = null;
        if (conditionPassed) {
            Object onTrue = config.get("onTrueStepIndex");
            if (onTrue instanceof Number num) {
                targetSequenceOrder = num.intValue();
            } else if (onTrue instanceof String str && !str.isBlank()) {
                try { targetSequenceOrder = Integer.parseInt(str.trim()); } catch (Exception e) {}
            }
        } else {
            Object onFalse = config.get("onFalseStepIndex");
            if (onFalse instanceof Number num) {
                targetSequenceOrder = num.intValue();
            } else if (onFalse instanceof String str && !str.isBlank()) {
                try { targetSequenceOrder = Integer.parseInt(str.trim()); } catch (Exception e) {}
            }
        }

        Map<String, Object> output = new java.util.LinkedHashMap<>();
        output.put("condition", condition);
        output.put("resolvedCondition", resolvedCondition);
        output.put("conditionResult", conditionPassed);
        output.put("nextStepSequenceOrder", targetSequenceOrder != null ? targetSequenceOrder : "SEQUENTIAL");

        if (targetSequenceOrder != null) {
            return StepResult.jump(targetSequenceOrder, output);
        } else {
            return StepResult.passed(output);
        }
    }

    private boolean evaluateCondition(String condition) {
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
}
