package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import com.bytezone.dm3270.TerminalClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class MainframeConnectExecutor implements StepExecutor {

    private final MainframeSessionPool mainframeSessionPool;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.MAINFRAME_CONNECT);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        log.info("Executing MAINFRAME_CONNECT step: {}", step.getName());

        String host = (String) config.get("mainframeHost");
        int port = ((Number) config.getOrDefault("mainframePort", 23)).intValue();
        int connectTimeoutMs = ((Number) config.getOrDefault("connectTimeoutMs", 10000)).intValue();
        String executionId = context.get("__executionId");

        if (host == null || host.isBlank()) {
            return StepResult.failed("Host is required for Mainframe Connect step.", Map.of());
        }

        try {
            TerminalClient client = mainframeSessionPool.getClient(executionId, host, port, connectTimeoutMs);
            if (mainframeSessionPool.isClientConnected(client)) {
                return StepResult.passed(Map.of(
                        "message", String.format("Successfully connected and established mainframe session to %s:%d.", host, port),
                        "host", host,
                        "port", port
                ));
            } else {
                return StepResult.failed("Failed to connect to mainframe terminal client.", Map.of());
            }
        } catch (Exception e) {
            log.error("Mainframe connect failed: {}", e.getMessage(), e);
            return StepResult.failed("Mainframe connection error: " + e.getMessage(), Map.of());
        }
    }
}
