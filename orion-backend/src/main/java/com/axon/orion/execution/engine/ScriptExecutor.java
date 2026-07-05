package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class ScriptExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.SCRIPT);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String script = (String) config.getOrDefault("script", "");
        log.info("[ORION-SCRIPT] Executing script for step '{}'", step.getName());

        Map<String, Object> output = new HashMap<>();
        output.put("script", script);

        try (Context polyglot = Context.newBuilder("js")
                .allowHostAccess(HostAccess.ALL) // Allows accessing Map methods like .put(), .get()
                .allowIO(false)
                .build()) {

            Value bindings = polyglot.getBindings("js");

            // Bind the context Map
            bindings.putMember("context", context);

            // Bind individual variables from context as global JS variables
            for (Map.Entry<String, String> entry : context.entrySet()) {
                bindings.putMember(entry.getKey(), entry.getValue());
            }

            Value evalResult = polyglot.eval("js", script);

            // Write back updated global variables that were modified in the script
            for (String key : bindings.getMemberKeys()) {
                if ("context".equals(key)) continue;
                Value valObj = bindings.getMember(key);
                if (valObj.isString()) {
                    context.put(key, valObj.asString());
                } else if (valObj.isNumber()) {
                    context.put(key, String.valueOf(valObj.as(Number.class)));
                } else if (valObj.isBoolean()) {
                    context.put(key, String.valueOf(valObj.asBoolean()));
                }
            }

            Object result = null;
            if (!evalResult.isNull()) {
                if (evalResult.isString()) {
                    result = evalResult.asString();
                } else if (evalResult.isNumber()) {
                    result = evalResult.as(Number.class);
                } else if (evalResult.isBoolean()) {
                    result = evalResult.asBoolean();
                } else {
                    result = evalResult.toString();
                }
            }

            output.put("result", result != null ? result : "SUCCESS");
            return StepResult.passed(output);

        } catch (Exception e) {
            log.error("Script execution failed: {}", e.getMessage(), e);
            output.put("result", "FAILED");
            return StepResult.failed(e.getMessage(), output);
        }
    }
}
