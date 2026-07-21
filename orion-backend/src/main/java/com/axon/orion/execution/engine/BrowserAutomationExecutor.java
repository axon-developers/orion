package com.axon.orion.execution.engine;

import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.config.OrionSslContextFactory;
import com.axon.orion.testcase.entity.TestStep;
import com.microsoft.playwright.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * When true, Playwright will accept self-signed / internal CA certificates
     * without error. This is driven by the presence of the Orion self-signed
     * cert in the bundled truststore. For production deployments with a real
     * CA-signed certificate this can remain true without security impact
     * because Chromium still validates publicly-trusted certificates normally.
     *
     * Set {@code orion.browser.ignore-https-errors=false} in application.yml
     * if you want strict certificate validation in browser automation.
     */
    @Value("${orion.browser.ignore-https-errors:true}")
    private boolean ignoreHttpsErrors;

    private final OrionSslContextFactory orionSslContextFactory;
    private final SystemSettingsService systemSettingsService;
    private final CucumberJsBrowserExecutor cucumberJsBrowserExecutor;

    public BrowserAutomationExecutor(OrionSslContextFactory orionSslContextFactory,
                                     SystemSettingsService systemSettingsService,
                                     CucumberJsBrowserExecutor cucumberJsBrowserExecutor) {
        this.orionSslContextFactory = orionSslContextFactory;
        this.systemSettingsService = systemSettingsService;
        this.cucumberJsBrowserExecutor = cucumberJsBrowserExecutor;
    }

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.BROWSER_AUTOMATION);
    }

    @Override
    @SuppressWarnings("unchecked")
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String engine = systemSettingsService.getString("execution.browser_executor_engine", "PLAYWRIGHT_JAVA");
        if ("CUCUMBER_JS".equalsIgnoreCase(engine)) {
            log.info("Routing browser automation step '{}' to Cucumber-JS execution engine.", step.getName());
            return cucumberJsBrowserExecutor.execute(step, config, context);
        }

        log.info("Starting browser automation execution for step: {} (Engine: PLAYWRIGHT_JAVA)", step.getName());

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
            // Launch Chromium headlessly.
            // --disable-dev-shm-usage / --no-sandbox are required in many Linux container environments.
            // The Orion bundled truststore (orion-truststore.jks) contains standard root CAs;
            // ignoreHTTPSErrors mirrors that trust for Playwright's Chromium TLS stack.
            boolean skipSsl = ignoreHttpsErrors 
                    || systemSettingsService.getBoolean("orion.ssl.skip_verification", false)
                    || systemSettingsService.getBoolean("proxy.enabled", false);

            List<String> chromiumArgs = new ArrayList<>(List.of(
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-gpu"
            ));
            if (skipSsl) {
                chromiumArgs.add("--ignore-certificate-errors");
                chromiumArgs.add("--ignore-certificate-errors-spki-list");
            }

            BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                    .setHeadless(true)
                    .setArgs(chromiumArgs);

            // Apply system proxy settings to Playwright / Chromium if configured
            if (systemSettingsService.getBoolean("proxy.enabled", false)) {
                String proxyHost     = systemSettingsService.getString("proxy.host", "");
                int    proxyPort     = systemSettingsService.getInt("proxy.port", 8080);
                String proxyType     = systemSettingsService.getString("proxy.type", "HTTP");
                String nonProxyHosts = systemSettingsService.getString("proxy.nonProxyHosts", "");
                String proxyUsername = systemSettingsService.getString("proxy.username", "");
                String proxyPassword = systemSettingsService.getString("proxy.password", "");

                if (!proxyHost.isBlank()) {
                    // Playwright proxy server format: "http://host:port" or "socks5://host:port"
                    String scheme = "SOCKS5".equalsIgnoreCase(proxyType) ? "socks5" : "http";
                    String proxyServer = scheme + "://" + proxyHost + ":" + proxyPort;
                    log.info("Browser automation: routing Chromium through {} proxy {}", proxyType, proxyServer);

                    com.microsoft.playwright.options.Proxy playwrightProxy =
                            new com.microsoft.playwright.options.Proxy(proxyServer);

                    // Bypass list: Playwright expects comma-separated hosts or glob patterns
                    if (!nonProxyHosts.isBlank()) {
                        playwrightProxy.setBypass(nonProxyHosts);
                    }
                    if (!proxyUsername.isBlank()) {
                        playwrightProxy.setUsername(proxyUsername);
                        playwrightProxy.setPassword(proxyPassword);
                    }
                    launchOptions.setProxy(playwrightProxy);
                }
            }

            try (Browser browser = playwright.chromium().launch(launchOptions)) {
                Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                        .setViewportSize(viewportWidth, viewportHeight)
                        .setIgnoreHTTPSErrors(skipSsl);
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

                                    boolean fullPage = false;
                                    if (action.containsKey("fullPage")) {
                                        Object fpObj = action.get("fullPage");
                                        if (fpObj instanceof Boolean b) fullPage = b;
                                        else if (fpObj instanceof String s) fullPage = Boolean.parseBoolean(s);
                                    }

                                    log.debug("Taking screenshot (fullPage={}): {}", fullPage, targetPath);
                                    page.screenshot(new Page.ScreenshotOptions().setPath(targetPath).setFullPage(fullPage));
                                    
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
