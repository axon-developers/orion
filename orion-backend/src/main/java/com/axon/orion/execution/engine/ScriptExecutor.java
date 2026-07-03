package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Script executor — evaluates simple expression scripts.
 * For V1, supports basic variable substitution and logging.
 * Full JavaScript execution (via GraalVM or Nashorn) can be added in V2.
 */
@Slf4j
@Component
public class ScriptExecutor {

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String script = VariableInterpolator.resolve((String) config.getOrDefault("script", ""), context);
        log.info("[ORION-SCRIPT] Executing script: {}", script);
        // V1: Script execution is logged but not evaluated
        // Add GraalVM JS engine here for V2
        return StepResult.passed(Map.of(
                "script", script,
                "info", "Script logging only in V1 — full JS execution planned for V2"
        ));
    }
}
