package com.axon.orion.execution.engine;

import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.common.util.VariableInterpolator;
import com.bytezone.dm3270.TerminalClient;
import com.bytezone.dm3270.display.ScreenDimensions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.List;

@Slf4j
@Component
public class MainframeTerminalExecutor implements StepExecutor {

    private static final String STORAGE_DIR = "storage/screenshots";

    @org.springframework.beans.factory.annotation.Autowired
    private MainframeSessionPool mainframeSessionPool;

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.MAINFRAME_TERMINAL);
    }

    @Override
    @SuppressWarnings("unchecked")
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        log.info("Starting mainframe terminal execution for step: {}", step.getName());

        String hostRaw = (String) config.get("mainframeHost");
        String host = VariableInterpolator.resolve(hostRaw, context);
        
        Object portObj = config.getOrDefault("mainframePort", 23);
        int port = 23;
        try {
            if (portObj instanceof String s) {
                port = Integer.parseInt(VariableInterpolator.resolve(s, context).trim());
            } else if (portObj instanceof Number n) {
                port = n.intValue();
            }
        } catch (Exception e) {
            log.warn("Failed to parse mainframePort: {}, using default 23", portObj, e);
        }

        boolean useSsl = (Boolean) config.getOrDefault("useSsl", false);
        int connectTimeoutMs = ((Number) config.getOrDefault("connectTimeoutMs", 10000)).intValue();
        List<Map<String, Object>> actions = (List<Map<String, Object>>) config.getOrDefault("mainframeActions", List.of());

        if (host == null || host.isBlank()) {
            return StepResult.failed("Host is required for Mainframe Terminal step.", Map.of());
        }

        if (actions.isEmpty()) {
            return StepResult.passed(Map.of("message", "No actions configured for mainframe terminal."));
        }

        // Ensure storage directory exists
        try {
            Files.createDirectories(Paths.get(STORAGE_DIR));
        } catch (IOException e) {
            log.error("Failed to create screenshot storage directory: {}", e.getMessage());
            return StepResult.failed("Failed to initialize storage: " + e.getMessage(), Map.of());
        }

        List<Map<String, Object>> actionLogs = new ArrayList<>();
        List<Map<String, Object>> screenshots = new ArrayList<>();
        List<StepResult.ExtractedVariable> extractedVars = new ArrayList<>();

        TerminalClient client = null;
        String executionId = context.get("__executionId");
        try {
            client = mainframeSessionPool.getClient(executionId, host, port, connectTimeoutMs);
            
            // Wait a brief moment to stabilize screen if it was just connected
            Thread.sleep(500);

            for (int i = 0; i < actions.size(); i++) {
                Map<String, Object> action = actions.get(i);
                String type = (String) action.getOrDefault("type", "");
                Map<String, Object> actionLog = new LinkedHashMap<>();
                actionLog.put("type", type);
                actionLog.put("index", i);
                long actionStartTime = System.currentTimeMillis();

                try {
                    switch (type.toLowerCase()) {
                        case "waitforfield":
                            int fieldTimeout = ((Number) action.getOrDefault("timeout", 10000)).intValue();
                            log.debug("Waiting for keyboard to unlock (timeout: {}ms)", fieldTimeout);
                            long fieldStart = System.currentTimeMillis();
                            while (client.isKeyboardLocked() && (System.currentTimeMillis() - fieldStart) < fieldTimeout) {
                                Thread.sleep(100);
                            }
                            if (client.isKeyboardLocked()) {
                                throw new RuntimeException("Keyboard lock timeout");
                            }
                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", "Keyboard unlocked");
                            break;

                        case "waitfortext":
                            String waitText = (String) action.get("text");
                            int textTimeout = ((Number) action.getOrDefault("timeout", 10000)).intValue();
                            if (waitText == null || waitText.isEmpty()) {
                                throw new IllegalArgumentException("Text is required for waitForText action.");
                            }
                            log.debug("Waiting for text '{}' (timeout: {}ms)", waitText, textTimeout);
                            long textStart = System.currentTimeMillis();
                            boolean found = false;
                            while ((System.currentTimeMillis() - textStart) < textTimeout) {
                                String currentScreen = client.getScreenText();
                                if (currentScreen != null && currentScreen.contains(waitText)) {
                                    found = true;
                                    break;
                                }
                                Thread.sleep(200);
                            }
                            if (!found) {
                                throw new RuntimeException("Timeout waiting for text: " + waitText);
                            }
                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", "Found text: " + waitText);
                            break;

                        case "input":
                            int row = ((Number) action.getOrDefault("row", 1)).intValue();
                            int col = ((Number) action.getOrDefault("col", 1)).intValue();
                            String valToInput = (String) action.getOrDefault("value", "");
                            log.debug("Setting input text at {}:{} -> {}", row, col, valToInput);
                            
                            client.setFieldTextByCoord(row, col, valToInput);

                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", String.format("Entered text at [%d, %d]", row, col));
                            break;

                        case "sendkey":
                            String keyStr = (String) action.getOrDefault("key", "ENTER");
                            byte aidKey = getAidKey(keyStr);
                            log.debug("Sending AID key: {}", keyStr);

                            client.sendAID(aidKey, keyStr);
                            Thread.sleep(300);

                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", "Sent key: " + keyStr);
                            break;

                        case "readfield":
                            int readRow = ((Number) action.getOrDefault("row", 1)).intValue();
                            int readCol = ((Number) action.getOrDefault("col", 1)).intValue();
                            int length = ((Number) action.getOrDefault("length", 1)).intValue();
                            String varName = (String) action.get("variableName");

                            log.debug("Reading field at {}:{} length {}", readRow, readCol, length);
                            String rawText = client.getScreenText().replace("\r", "").replace("\n", "");
                            int startIdx = (readRow - 1) * 80 + (readCol - 1);
                            int endIdx = Math.min(startIdx + length, rawText.length());

                            String valExtracted = "";
                            if (startIdx >= 0 && startIdx < rawText.length()) {
                                valExtracted = rawText.substring(startIdx, endIdx).trim();
                            }

                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", String.format("Read value: '%s'", valExtracted));
                            actionLog.put("extractedValue", valExtracted);

                            if (varName != null && !varName.isBlank()) {
                                extractedVars.add(new StepResult.ExtractedVariable(varName, valExtracted));
                                actionLog.put("variableName", varName);
                            }
                            break;

                        case "screenshot":
                            String snapName = (String) action.getOrDefault("name", "snap_" + i);
                            String filename = step.getId() + "_mainframe_" + i + "_" + System.currentTimeMillis() + ".png";
                            Path targetPath = Paths.get(STORAGE_DIR, filename);
                            log.debug("Capturing mainframe screenshot: {}", targetPath);
                            captureScreen(client, targetPath);

                            Map<String, Object> screenshotMeta = new LinkedHashMap<>();
                            screenshotMeta.put("name", snapName);
                            screenshotMeta.put("filename", filename);
                            screenshotMeta.put("path", STORAGE_DIR + "/" + filename);
                            screenshots.add(screenshotMeta);

                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", "Screenshot taken: " + snapName);
                            break;

                        case "sleep":
                            int duration = ((Number) action.getOrDefault("duration", 1000)).intValue();
                            log.debug("Sleeping for {}ms", duration);
                            Thread.sleep(duration);
                            actionLog.put("status", "SUCCESS");
                            actionLog.put("message", "Slept for " + duration + "ms");
                            break;

                        default:
                            throw new IllegalArgumentException("Unsupported mainframe terminal action type: " + type);
                    }
                    actionLog.put("durationMs", System.currentTimeMillis() - actionStartTime);
                } catch (Exception e) {
                    log.error("Error executing mainframe action {}: {}", type, e.getMessage());
                    actionLog.put("status", "FAILED");
                    actionLog.put("error", e.getMessage());
                    actionLog.put("durationMs", System.currentTimeMillis() - actionStartTime);
                    actionLogs.add(actionLog);

                    return StepResult.failed(
                            String.format("Action %d (%s) failed: %s", i, type, e.getMessage()),
                            Map.of("actions", actionLogs, "screenshots", screenshots)
                    );
                }
                actionLogs.add(actionLog);
            }
        } catch (Exception e) {
            log.error("Fatal error in mainframe terminal execution: {}", e.getMessage(), e);
            return StepResult.failed("Fatal mainframe terminal error: " + e.getMessage(),
                    Map.of("actions", actionLogs, "screenshots", screenshots));
        } finally {
            if (client != null && executionId == null) {
                try {
                    client.disconnect();
                } catch (Exception e) {
                    log.error("Error disconnecting from mainframe: {}", e.getMessage());
                }
            }
        }

        Map<String, Object> output = Map.of(
                "actions", actionLogs,
                "screenshots", screenshots,
                "message", "Mainframe terminal automation completed successfully."
        );

        if (!extractedVars.isEmpty()) {
            return StepResult.withVariables(extractedVars, output);
        }
        return StepResult.passed(output);
    }

    private byte getAidKey(String key) {
        if (key == null) return com.bytezone.dm3270.commands.AIDCommand.AID_ENTER;
        return switch (key.toUpperCase()) {
            case "ENTER" -> com.bytezone.dm3270.commands.AIDCommand.AID_ENTER;
            case "CLEAR" -> com.bytezone.dm3270.commands.AIDCommand.AID_CLEAR;
            case "PA1" -> com.bytezone.dm3270.commands.AIDCommand.AID_PA1;
            case "PA2" -> com.bytezone.dm3270.commands.AIDCommand.AID_PA2;
            case "PA3" -> com.bytezone.dm3270.commands.AIDCommand.AID_PA3;
            case "PF1" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF1;
            case "PF2" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF2;
            case "PF3" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF3;
            case "PF4" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF4;
            case "PF5" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF5;
            case "PF6" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF6;
            case "PF7" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF7;
            case "PF8" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF8;
            case "PF9" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF9;
            case "PF10" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF10;
            case "PF11" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF11;
            case "PF12" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF12;
            case "PF13" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF13;
            case "PF14" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF14;
            case "PF15" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF15;
            case "PF16" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF16;
            case "PF17" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF17;
            case "PF18" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF18;
            case "PF19" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF19;
            case "PF20" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF20;
            case "PF21" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF21;
            case "PF22" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF22;
            case "PF23" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF23;
            case "PF24" -> com.bytezone.dm3270.commands.AIDCommand.AID_PF24;
            default -> com.bytezone.dm3270.commands.AIDCommand.AID_ENTER;
        };
    }

    private void captureScreen(TerminalClient client, Path targetPath) throws IOException {
        int rows = 24;
        int cols = 80;
        int charWidth = 8;
        int charHeight = 15;

        int width = cols * charWidth + 20;
        int height = rows * charHeight + 20;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();

        // Set background to black
        g2d.setColor(Color.BLACK);
        g2d.fillRect(0, 0, width, height);

        // Set text rendering options
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        // Set Font to Monospaced
        g2d.setFont(new Font("Courier New", Font.PLAIN, 14));
        g2d.setColor(new Color(0, 255, 0)); // Classic CRT Green

        String screenText = client.getScreenText().replace("\r", "").replace("\n", "");
        for (int r = 0; r < rows; r++) {
            int start = r * cols;
            int end = Math.min(start + cols, screenText.length());
            if (start < screenText.length()) {
                String line = screenText.substring(start, end);
                g2d.drawString(line, 10, 10 + (r + 1) * charHeight);
            }
        }

        g2d.dispose();
        ImageIO.write(image, "png", targetPath.toFile());
    }
}
