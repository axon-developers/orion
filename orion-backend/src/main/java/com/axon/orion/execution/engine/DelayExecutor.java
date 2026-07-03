package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class DelayExecutor {

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        int durationMs = ((Number) config.getOrDefault("durationMs", 1000)).intValue();
        try {
            log.debug("Delaying for {}ms", durationMs);
            Thread.sleep(durationMs);
            return StepResult.passed(Map.of("durationMs", durationMs, "message", "Delay completed"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return StepResult.failed("Delay interrupted", Map.of("durationMs", durationMs));
        }
    }
}
