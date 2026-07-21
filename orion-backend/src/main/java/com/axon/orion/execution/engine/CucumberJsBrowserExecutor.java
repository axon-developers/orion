package com.axon.orion.execution.engine;

import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class CucumberJsBrowserExecutor {

    private final SystemSettingsService systemSettingsService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @SuppressWarnings("unchecked")
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        log.info("Executing browser automation via Cucumber-JS runner for step: {}", step.getName());

        int viewportWidth = ((Number) config.getOrDefault("viewportWidth", 1280)).intValue();
        int viewportHeight = ((Number) config.getOrDefault("viewportHeight", 720)).intValue();
        List<Map<String, Object>> actions = (List<Map<String, Object>>) config.getOrDefault("actions", List.of());

        if (actions.isEmpty()) {
            return StepResult.passed(Map.of("message", "No actions configured for Cucumber-JS automation."));
        }
        try {
            File storageDirFile = new File("storage/screenshots");
            if (!storageDirFile.exists()) {
                storageDirFile.mkdirs();
            }

            // Prepare payload
            Map<String, Object> payload = new HashMap<>();
            payload.put("actions", actions);
            payload.put("viewport", Map.of("width", viewportWidth, "height", viewportHeight));
            payload.put("storageDir", storageDirFile.getAbsolutePath());

            Map<String, Object> options = new HashMap<>();
            boolean skipSsl = systemSettingsService.getBoolean("orion.ssl.skip_verification", false)
                    || systemSettingsService.getBoolean("proxy.enabled", false);
            options.put("ignoreHttpsErrors", skipSsl);

            if (systemSettingsService.getBoolean("proxy.enabled", false)) {
                String proxyHost = systemSettingsService.getString("proxy.host", "");
                int proxyPort = systemSettingsService.getInt("proxy.port", 8080);
                String proxyType = systemSettingsService.getString("proxy.type", "HTTP");
                if (!proxyHost.isBlank()) {
                    String scheme = "SOCKS5".equalsIgnoreCase(proxyType) ? "socks5" : "http";
                    options.put("proxyServer", scheme + "://" + proxyHost + ":" + proxyPort);
                    options.put("bypassList", systemSettingsService.getString("proxy.nonProxyHosts", ""));
                    options.put("username", systemSettingsService.getString("proxy.username", ""));
                    options.put("password", systemSettingsService.getString("proxy.password", ""));
                }
            }
            payload.put("options", options);

            Path tempPayload = Files.createTempFile("cucumber-payload-", ".json");
            Files.writeString(tempPayload, objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8);

            // Locate script
            File scriptFile = new File("src/main/resources/scripts/cucumber-runner.js");
            if (!scriptFile.exists()) {
                scriptFile = new File("target/classes/scripts/cucumber-runner.js");
            }
            if (!scriptFile.exists()) {
                scriptFile = new File("scripts/cucumber-runner.js");
            }

            if (!scriptFile.exists()) {
                return StepResult.failed("Cucumber runner script not found at target location: " + scriptFile.getAbsolutePath(), Map.of());
            }

            ProcessBuilder processBuilder = new ProcessBuilder("node", scriptFile.getAbsolutePath(), tempPayload.toAbsolutePath().toString());
            File scriptDir = scriptFile.getParentFile();
            if (scriptDir != null && scriptDir.exists()) {
                processBuilder.directory(scriptDir);
                File nodeModules = new File(scriptDir, "node_modules");
                if (!nodeModules.exists()) {
                    File srcNodeModules = new File("src/main/resources/scripts/node_modules");
                    if (srcNodeModules.exists()) {
                        nodeModules = srcNodeModules;
                    }
                }
                if (nodeModules.exists()) {
                    processBuilder.environment().put("NODE_PATH", nodeModules.getAbsolutePath());
                }
            }
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            Files.deleteIfExists(tempPayload);

            String rawJson = output.toString().trim();
            log.debug("Cucumber-JS execution output: {}", rawJson);

            if (exitCode == 0 && rawJson.contains("\"status\":\"PASSED\"")) {
                Map<String, Object> resultData = objectMapper.readValue(rawJson, Map.class);
                normalizeResultData(resultData);
                return StepResult.passed(resultData);
            } else {
                Map<String, Object> resultData = new HashMap<>();
                try {
                    resultData = objectMapper.readValue(rawJson, Map.class);
                } catch (Exception ignored) {
                    resultData.put("rawOutput", rawJson);
                }
                normalizeResultData(resultData);
                String errorMsg = (String) resultData.getOrDefault("errorMessage", "Cucumber-JS execution failed with exit code " + exitCode);
                return StepResult.failed(errorMsg, resultData);
            }
        } catch (Exception e) {
            log.error("Failed to execute Cucumber-JS browser automation", e);
            return StepResult.failed("Cucumber-JS Execution Error: " + e.getMessage(), Map.of("error", e.getMessage()));
        }
    }

    @SuppressWarnings("unchecked")
    private void normalizeResultData(Map<String, Object> resultData) {
        if (resultData == null) return;

        if (!resultData.containsKey("actions") && resultData.containsKey("logs")) {
            resultData.put("actions", resultData.get("logs"));
        }

        List<Map<String, Object>> actions = (List<Map<String, Object>>) resultData.get("actions");
        List<Map<String, Object>> screenshots = (List<Map<String, Object>>) resultData.get("screenshots");
        if (screenshots == null) {
            screenshots = new ArrayList<>();
            resultData.put("screenshots", screenshots);
        }

        if (actions != null) {
            for (Map<String, Object> action : actions) {
                String status = (String) action.get("status");
                if ("PASSED".equalsIgnoreCase(status)) {
                    action.put("status", "SUCCESS");
                }

                String filename = (String) action.get("filename");
                String name = (String) action.getOrDefault("name", "screenshot");
                if (filename != null && !filename.isBlank()) {
                    boolean alreadyPresent = false;
                    for (Map<String, Object> existing : screenshots) {
                        if (filename.equals(existing.get("filename"))) {
                            alreadyPresent = true;
                            break;
                        }
                    }
                    if (!alreadyPresent) {
                        Map<String, Object> shot = new LinkedHashMap<>();
                        shot.put("name", name);
                        shot.put("filename", filename);
                        shot.put("path", "storage/screenshots/" + filename);
                        screenshots.add(shot);
                    }
                }
            }
        }
    }
}
