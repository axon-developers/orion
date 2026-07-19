package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class DbConnectExecutor implements StepExecutor {

    private final DatabaseQueryExecutor databaseQueryExecutor;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.DB_CONNECT);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        log.info("Executing DB_CONNECT step: {}", step.getName());
        
        Map<String, Object> selectConfig = new LinkedHashMap<>(config);
        // Execute a lightweight validation query to initialize and pool the connection
        selectConfig.put("query", "SELECT 1");

        TestStep dummyStep = new TestStep();
        dummyStep.setId(step.getId());
        dummyStep.setName(step.getName());
        dummyStep.setStepType(TestStep.StepType.DATABASE_QUERY);
        
        StepResult result = databaseQueryExecutor.execute(dummyStep, selectConfig, context);
        if (result.passed()) {
            return StepResult.passed(Map.of("message", "Database connection established and cached successfully."));
        } else {
            return StepResult.failed("Failed to connect to database: " + result.errorMessage(), result.output());
        }
    }
}
