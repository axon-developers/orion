package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import com.microsoft.playwright.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Slf4j
@Component
public class BrowserAutomationExecutor implements StepExecutor {

    private static final String STORAGE_DIR = "storage/screenshots";

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.BROWSER_AUTOMATION);
    }

    @Override
    @SuppressWarnings("unchecked")
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        log.info("Starting browser automation execution for step: {}", step.getName());

        int viewportWidth = ((Number) config.getOrDefault("viewportWidth", 1280)).intValue();
        int viewportHeight = ((Number) config.getOrDefault("viewportHeight", 720)).intValue();
        List<Map<String, Object>> actions = (List<Map<String, Object>>) config.getOrDefault("actions", List.of());

        if (actions.isEmpty()) {
            return StepResult.passed(Map.of("message", "No actions configured for browser automation."));
        }

        List<Map<String, Object>> actionLogs = new ArrayList<>();
        List<Map<String, Object>> screenshots = new ArrayList<>();
        
        // Ensure storage directory exists
        try {
            Files.createDirectories(Paths.get(STORAGE_DIR));
        } catch (IOException e) {
            log.error("Failed to create screenshot storage directory: {}", e.getMessage());
            return StepResult.failed("Failed to initialize storage: " + e.getMessage(), Map.of());
        }

        // Initialize Playwright
        try (Playwright playwright = Playwright.create()) {
            // Launch chromium headlessly
            try (Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true))) {
                Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                        .setViewportSize(viewportWidth, viewportHeight);
                try (BrowserContext browserContext = browser.newContext(contextOptions)) {
                    Page page = browserContext.newPage();

                    for (int i = 0; i < actions.size(); i++) {
                        Map<String, Object> action = actions.get(i);
                        String type = (String) action.getOrDefault("type", "");
                        Map<String, Object> actionLog = new LinkedHashMap<>();
                        actionLog.put("type", type);
                        actionLog.put("index", i);

                        try {
                            switch (type.toLowerCase()) {
                                case "navigate":
                                    String url = (String) action.get("url");
                                    if (url == null || url.isBlank()) {
                                        throw new IllegalArgumentException("URL is required for navigate action.");
                                    }
                                    log.debug("Navigating to: {}", url);
                                    page.navigate(url);
                                    actionLog.put("status", "SUCCESS");
                                    actionLog.put("message", "Navigated to " + url);
                                    break;

                                case "fill":
                                    String fillSelector = (String) action.get("selector");
                                    String value = (String) action.get("value");
                                    if (fillSelector == null || fillSelector.isBlank()) {
                                        throw new IllegalArgumentException("Selector is required for fill action.");
                                    }
                                    log.debug("Filling element {} with value", fillSelector);
                                    page.locator(fillSelector).fill(value != null ? value : "");
                                    actionLog.put("status", "SUCCESS");
                                    actionLog.put("message", "Filled selector " + fillSelector);
                                    break;

                                case "click":
                                    String clickSelector = (String) action.get("selector");
                                    if (clickSelector == null || clickSelector.isBlank()) {
                                        throw new IllegalArgumentException("Selector is required for click action.");
                                    }
                                    log.debug("Clicking element: {}", clickSelector);
                                    page.locator(clickSelector).click();
                                    actionLog.put("status", "SUCCESS");
                                    actionLog.put("message", "Clicked selector " + clickSelector);
                                    break;

                                case "waitforelement":
                                    String waitSelector = (String) action.get("selector");
                                    int timeout = ((Number) action.getOrDefault("timeout", 10000)).intValue();
                                    if (waitSelector == null || waitSelector.isBlank()) {
                                        throw new IllegalArgumentException("Selector is required for waitForElement action.");
                                    }
                                    log.debug("Waiting for element: {}", waitSelector);
                                    page.locator(waitSelector).waitFor(new Locator.WaitForOptions().setTimeout(timeout));
                                    actionLog.put("status", "SUCCESS");
                                    actionLog.put("message", "Element visible: " + waitSelector);
                                    break;

                                case "screenshot":
                                    String name = (String) action.getOrDefault("name", "screenshot_" + i);
                                    String filename = step.getId() + "_" + i + "_" + System.currentTimeMillis() + ".png";
                                    Path targetPath = Paths.get(STORAGE_DIR, filename);
                                    log.debug("Taking screenshot: {}", targetPath);
                                    page.screenshot(new Page.ScreenshotOptions().setPath(targetPath));
                                    
                                    Map<String, Object> screenshotMeta = new LinkedHashMap<>();
                                    screenshotMeta.put("name", name);
                                    screenshotMeta.put("filename", filename);
                                    screenshotMeta.put("path", STORAGE_DIR + "/" + filename);
                                    screenshots.add(screenshotMeta);

                                    actionLog.put("status", "SUCCESS");
                                    actionLog.put("message", "Screenshot taken: " + name);
                                    break;

                                default:
                                    throw new IllegalArgumentException("Unsupported browser automation action type: " + type);
                            }
                        } catch (Exception e) {
                            log.error("Error executing browser action {}: {}", type, e.getMessage());
                            actionLog.put("status", "FAILED");
                            actionLog.put("error", e.getMessage());
                            actionLogs.add(actionLog);

                            return StepResult.failed(
                                    String.format("Action %d (%s) failed: %s", i, type, e.getMessage()),
                                    Map.of("actions", actionLogs, "screenshots", screenshots)
                            );
                        }
                        actionLogs.add(actionLog);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Fatal error in browser automation: {}", e.getMessage(), e);
            return StepResult.failed("Fatal browser automation error: " + e.getMessage(), 
                    Map.of("actions", actionLogs, "screenshots", screenshots));
        }

        return StepResult.passed(Map.of(
                "actions", actionLogs,
                "screenshots", screenshots,
                "message", "Browser automation completed successfully."
        ));
    }
}
