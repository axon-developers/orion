package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

public class BrowserAutomationExecutorTest {

    @Test
    @SuppressWarnings("unchecked")
    public void testBrowserAutomationSuccess() throws IOException {
        com.axon.orion.config.OrionSslContextFactory sslContextFactory = org.mockito.Mockito.mock(com.axon.orion.config.OrionSslContextFactory.class);
        com.axon.orion.admin.service.SystemSettingsService settingsService = org.mockito.Mockito.mock(com.axon.orion.admin.service.SystemSettingsService.class);
        CucumberJsBrowserExecutor cucumberJsExecutor = org.mockito.Mockito.mock(CucumberJsBrowserExecutor.class);
        try {
            org.mockito.Mockito.when(sslContextFactory.getOrionSslContext()).thenReturn(javax.net.ssl.SSLContext.getDefault());
        } catch (Exception e) {}
        org.mockito.Mockito.when(settingsService.getBoolean(org.mockito.Mockito.anyString(), org.mockito.Mockito.anyBoolean())).thenReturn(false);
        org.mockito.Mockito.when(settingsService.getString("execution.browser_executor_engine", "PLAYWRIGHT_JAVA")).thenReturn("PLAYWRIGHT_JAVA");
        
        BrowserAutomationExecutor executor = new BrowserAutomationExecutor(sslContextFactory, settingsService, cucumberJsExecutor);
        
        TestStep step = new TestStep();
        step.setId("test-step-uuid-123");
        step.setName("Test Browser Step");

        // We use a data: URI to inject HTML directly into the page without a server
        String htmlContent = "<html><body>" +
                "<h1 id='title'>Initial Title</h1>" +
                "<input id='inp' type='text' />" +
                "<button id='btn' onclick=\"document.getElementById('title').innerText='Clicked'\">Button</button>" +
                "</body></html>";
        String dataUri = "data:text/html;charset=utf-8," + htmlContent;

        Map<String, Object> config = new HashMap<>();
        config.put("viewportWidth", 800);
        config.put("viewportHeight", 600);

        List<Map<String, Object>> actions = new ArrayList<>();
        
        // Action 1: Navigate
        actions.add(Map.of("type", "navigate", "url", dataUri));
        
        // Action 2: Fill input
        actions.add(Map.of("type", "fill", "selector", "#inp", "value", "Test Value"));
        
        // Action 3: Click button
        actions.add(Map.of("type", "click", "selector", "#btn"));
        
        // Action 4: Wait for changed title (we just wait for the button as check)
        actions.add(Map.of("type", "waitForElement", "selector", "#title"));
        
        // Action 5: Screenshot
        actions.add(Map.of("type", "screenshot", "name", "final_page"));

        config.put("actions", actions);

        Map<String, String> context = new HashMap<>();
        
        StepResult result = executor.execute(step, config, context);

        // Verify Step Results
        assertThat(result.passed()).isTrue();
        
        Map<String, Object> output = result.output();
        assertThat(output).containsKey("actions");
        assertThat(output).containsKey("screenshots");

        List<Map<String, Object>> actionLogs = (List<Map<String, Object>>) output.get("actions");
        assertThat(actionLogs).hasSize(5);
        assertThat(actionLogs.get(0).get("status")).isEqualTo("SUCCESS");
        assertThat(actionLogs.get(1).get("status")).isEqualTo("SUCCESS");
        assertThat(actionLogs.get(2).get("status")).isEqualTo("SUCCESS");
        assertThat(actionLogs.get(3).get("status")).isEqualTo("SUCCESS");
        assertThat(actionLogs.get(4).get("status")).isEqualTo("SUCCESS");

        List<Map<String, Object>> screenshots = (List<Map<String, Object>>) output.get("screenshots");
        assertThat(screenshots).hasSize(1);
        
        Map<String, Object> screenshotMeta = screenshots.get(0);
        assertThat(screenshotMeta.get("name")).isEqualTo("final_page");
        
        String pathStr = (String) screenshotMeta.get("path");
        Path screenshotPath = Paths.get(pathStr);
        
        // Check file exists
        assertThat(Files.exists(screenshotPath)).isTrue();

        // Clean up screenshot file
        Files.deleteIfExists(screenshotPath);
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testBrowserAutomationFailure() {
        com.axon.orion.config.OrionSslContextFactory sslContextFactory = org.mockito.Mockito.mock(com.axon.orion.config.OrionSslContextFactory.class);
        com.axon.orion.admin.service.SystemSettingsService settingsService = org.mockito.Mockito.mock(com.axon.orion.admin.service.SystemSettingsService.class);
        CucumberJsBrowserExecutor cucumberJsExecutor = org.mockito.Mockito.mock(CucumberJsBrowserExecutor.class);
        try {
            org.mockito.Mockito.when(sslContextFactory.getOrionSslContext()).thenReturn(javax.net.ssl.SSLContext.getDefault());
        } catch (Exception e) {}
        org.mockito.Mockito.when(settingsService.getBoolean(org.mockito.Mockito.anyString(), org.mockito.Mockito.anyBoolean())).thenReturn(false);
        org.mockito.Mockito.when(settingsService.getString("execution.browser_executor_engine", "PLAYWRIGHT_JAVA")).thenReturn("PLAYWRIGHT_JAVA");

        BrowserAutomationExecutor executor = new BrowserAutomationExecutor(sslContextFactory, settingsService, cucumberJsExecutor);
        
        TestStep step = new TestStep();
        step.setId("test-step-uuid-456");
        step.setName("Test Browser Failure Step");

        Map<String, Object> config = new HashMap<>();
        List<Map<String, Object>> actions = new ArrayList<>();
        
        // Action 1: Navigate to valid blank page
        actions.add(Map.of("type", "navigate", "url", "about:blank"));
        
        // Action 2: Click non-existent element with short timeout to fail fast
        actions.add(Map.of("type", "waitForElement", "selector", "#non-existent-button", "timeout", 1000));

        config.put("actions", actions);

        Map<String, String> context = new HashMap<>();
        
        StepResult result = executor.execute(step, config, context);

        // Verify Step fails due to missing element
        assertThat(result.passed()).isFalse();
        assertThat(result.errorMessage()).contains("Timeout");
        
        List<Map<String, Object>> actionLogs = (List<Map<String, Object>>) result.output().get("actions");
        assertThat(actionLogs).hasSize(2);
        assertThat(actionLogs.get(0).get("status")).isEqualTo("SUCCESS");
        assertThat(actionLogs.get(1).get("status")).isEqualTo("FAILED");
    }
}
