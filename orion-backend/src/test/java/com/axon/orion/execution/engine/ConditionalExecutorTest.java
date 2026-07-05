package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class ConditionalExecutorTest {

    @Test
    public void testEvaluateConditionTrue() {
        ConditionalExecutor executor = new ConditionalExecutor();
        TestStep step = new TestStep();
        step.setName("Branching step");

        Map<String, Object> config = new HashMap<>();
        config.put("condition", "{{statusCode}} == 200");
        config.put("onTrueStepIndex", 5);
        config.put("onFalseStepIndex", 10);

        Map<String, String> context = new HashMap<>();
        context.put("statusCode", "200");

        StepResult result = executor.execute(step, config, context);

        assertThat(result.passed()).isTrue();
        assertThat(result.nextStepSequenceOrder()).isEqualTo(5);
        assertThat(result.output().get("conditionResult")).isEqualTo(true);
    }

    @Test
    public void testEvaluateConditionFalse() {
        ConditionalExecutor executor = new ConditionalExecutor();
        TestStep step = new TestStep();
        step.setName("Branching step");

        Map<String, Object> config = new HashMap<>();
        config.put("condition", "{{statusCode}} == 200");
        config.put("onTrueStepIndex", 5);
        config.put("onFalseStepIndex", 10);

        Map<String, String> context = new HashMap<>();
        context.put("statusCode", "404");

        StepResult result = executor.execute(step, config, context);

        assertThat(result.passed()).isTrue();
        assertThat(result.nextStepSequenceOrder()).isEqualTo(10);
        assertThat(result.output().get("conditionResult")).isEqualTo(false);
    }
}
