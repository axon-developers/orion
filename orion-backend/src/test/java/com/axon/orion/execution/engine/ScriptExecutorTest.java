package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class ScriptExecutorTest {

    @Test
    public void testScriptExecutionSuccess() {
        ScriptExecutor executor = new ScriptExecutor();
        TestStep step = new TestStep();
        step.setName("Test JS Script");

        Map<String, Object> config = new HashMap<>();
        config.put("script", "var x = 10; var y = 20; x + y;");

        Map<String, String> context = new HashMap<>();
        StepResult result = executor.execute(step, config, context);

        assertThat(result.passed()).isTrue();
        assertThat(((Number) result.output().get("result")).doubleValue()).isEqualTo(30.0);
    }

    @Test
    public void testScriptContextModification() {
        ScriptExecutor executor = new ScriptExecutor();
        TestStep step = new TestStep();
        step.setName("Test JS Context Modification");

        Map<String, Object> config = new HashMap<>();
        config.put("script", "context.put('myVar', 'newValue'); status = 'SUCCESSFUL';");

        Map<String, String> context = new HashMap<>();
        context.put("status", "PENDING");

        StepResult result = executor.execute(step, config, context);

        assertThat(result.passed()).isTrue();
        assertThat(context.get("myVar")).isEqualTo("newValue");
        assertThat(context.get("status")).isEqualTo("SUCCESSFUL");
    }

    @Test
    public void testScriptExecutionFailure() {
        ScriptExecutor executor = new ScriptExecutor();
        TestStep step = new TestStep();
        step.setName("Test Bad Script");

        Map<String, Object> config = new HashMap<>();
        config.put("script", "throw new Error('Something went wrong');");

        Map<String, String> context = new HashMap<>();
        StepResult result = executor.execute(step, config, context);

        assertThat(result.passed()).isFalse();
        assertThat(result.errorMessage()).contains("Something went wrong");
    }
}
