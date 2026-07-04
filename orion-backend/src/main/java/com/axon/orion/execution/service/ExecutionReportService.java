package com.axon.orion.execution.service;

import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionReportService {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestCaseRepository testCaseRepository;
    private final EnvironmentRepository environmentRepository;
    private final TestStepRepository testStepRepository;
    private final JavaMailSender mailSender;
    private final ObjectMapper objectMapper;

    @Value("${orion.mail.from:noreply@orion-testing.com}")
    private String mailFrom;

    public void sendExecutionReport(String executionId, String recipientEmail) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", executionId));

        TestCase testCase = testCaseRepository.findById(execution.getTestCaseId())
                .orElse(null);
        String testCaseName = testCase != null ? testCase.getName() : "Unknown TestCase";

        Environment env = execution.getEnvironmentId() != null
                ? environmentRepository.findById(execution.getEnvironmentId()).orElse(null)
                : null;
        String envName = env != null ? env.getName() : "Default / None";

        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(executionId);

        String htmlContent = generateHtmlReport(execution, testCaseName, envName, logs);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom(mailFrom);
            helper.setTo(recipientEmail);
            helper.setSubject("ORION Test Execution Report: " + testCaseName + " (" + execution.getStatus().name() + ")");
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Execution report for execution {} sent to {}", executionId, recipientEmail);
        } catch (Exception e) {
            log.error("Failed to send execution report email for execution {}: {}", executionId, e.getMessage(), e);
            throw new RuntimeException("Failed to send report email: " + e.getMessage(), e);
        }
    }

    private String generateHtmlReport(Execution execution, String testCaseName, String envName, List<ExecutionStepLog> logs) {
        String status = execution.getStatus().name();
        String statusColor = getStatusColor(status);
        String formattedDuration = execution.getDurationMs() != null
                ? String.format("%.2fs", execution.getDurationMs() / 1000.0)
                : "--";

        String formattedDate = "--";
        if (execution.getStartedAt() != null) {
            try {
                Instant instant = Instant.parse(execution.getStartedAt());
                formattedDate = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss UTC")
                        .withZone(ZoneId.of("UTC"))
                        .format(instant);
            } catch (Exception e) {
                formattedDate = execution.getStartedAt();
            }
        }

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>")
            .append("<html>")
            .append("<head>")
            .append("<meta charset='utf-8'>")
            .append("<title>ORION Execution Report</title>")
            .append("<style>")
            .append("body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; color: #111827; margin: 0; padding: 20px; }")
            .append(".container { max-width: 800px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }")
            .append(".header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #FFFFFF; padding: 30px; text-align: left; }")
            .append(".header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }")
            .append(".header p { margin: 5px 0 0 0; opacity: 0.85; font-size: 14px; }")
            .append(".badge { display: inline-block; padding: 6px 12px; font-weight: 700; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }")
            .append(".badge-passed { background-color: #DEF7EC; color: #03543F; }")
            .append(".badge-failed { background-color: #FDE8E8; color: #9B1C1C; }")
            .append(".badge-running { background-color: #E1EFFE; color: #1E429F; }")
            .append(".badge-queued { background-color: #FEF08A; color: #713F12; }")
            .append(".badge-cancelled { background-color: #F3F4F6; color: #374151; }")
            .append(".content { padding: 30px; }")
            .append(".summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }")
            .append("@media (min-width: 600px) { .summary-grid { grid-template-columns: repeat(4, 1fr); } }")
            .append(".summary-card { background-color: #F3F4F6; padding: 15px; border-radius: 8px; text-align: left; border: 1px solid #E5E7EB; }")
            .append(".summary-card .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6B7280; margin-bottom: 5px; }")
            .append(".summary-card .value { font-size: 16px; font-weight: 800; color: #111827; }")
            .append(".error-box { background-color: #FDF2F2; border: 1px solid #FDE8E8; border-left: 4px solid #F05252; padding: 15px; border-radius: 8px; color: #9B1C1C; font-size: 14px; font-weight: 600; margin-bottom: 30px; }")
            .append(".section-title { font-size: 18px; font-weight: 700; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; display: flex; align-items: center; }")
            .append(".step-list { display: flex; flex-direction: column; gap: 12px; }")
            .append(".step-card { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; background-color: #FFFFFF; transition: border-color 0.15s ease-in-out; }")
            .append(".step-header { padding: 12px 15px; display: flex; align-items: center; justify-content: space-between; background-color: #F9FAFB; cursor: pointer; }")
            .append(".step-info { display: flex; align-items: center; gap: 10px; }")
            .append(".step-number { font-size: 12px; font-weight: 700; color: #9CA3AF; min-width: 20px; }")
            .append(".step-status-bullet { height: 10px; width: 10px; border-radius: 50%; display: inline-block; }")
            .append(".bullet-passed { background-color: #10B981; }")
            .append(".bullet-failed { background-color: #EF4444; }")
            .append(".bullet-skipped { background-color: #9CA3AF; }")
            .append(".bullet-running { background-color: #3B82F6; }")
            .append(".step-name { font-size: 14px; font-weight: 600; color: #111827; }")
            .append(".step-type { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6B7280; background-color: #E5E7EB; padding: 2px 6px; border-radius: 4px; font-family: monospace; }")
            .append(".step-duration { font-size: 12px; color: #6B7280; font-family: monospace; }")
            .append(".step-error { background-color: #FDF2F2; color: #9B1C1C; padding: 10px 15px; font-size: 13px; border-top: 1px dashed #FDE8E8; font-weight: 500; }")
            .append(".step-payloads { padding: 15px; border-top: 1px solid #E5E7EB; background-color: #FAFBFB; display: flex; flex-direction: column; gap: 10px; }")
            .append(".payload-title { font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase; margin-bottom: 4px; }")
            .append("pre { margin: 0; background-color: #1F2937; color: #F9FAFB; padding: 10px; border-radius: 6px; font-size: 11px; font-family: Consolas, Monaco, monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }")
            .append(".footer { text-align: center; padding: 20px; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; background-color: #F9FAFB; }")
            .append("</style>")
            .append("</head>")
            .append("<body>")
            .append("<div class='container'>")
            
            // Header
            .append("<div class='header'>")
            .append("<h1>ORION Test Execution Report</h1>")
            .append("<p>Test Case: <strong>").append(escapeHtml(testCaseName)).append("</strong></p>")
            .append("<p>Execution ID: ").append(execution.getId()).append("</p>")
            .append("</div>")

            // Content
            .append("<div class='content'>")
            
            // Summary Grid
            .append("<div class='summary-grid'>")
            .append("<div class='summary-card'>")
            .append("<div class='label'>Status</div>")
            .append("<div class='value'><span class='badge ").append(getBadgeClass(status)).append("'>").append(status).append("</span></div>")
            .append("</div>")
            .append("<div class='summary-card'>")
            .append("<div class='label'>Duration</div>")
            .append("<div class='value'>").append(formattedDuration).append("</div>")
            .append("</div>")
            .append("<div class='summary-card'>")
            .append("<div class='label'>Environment</div>")
            .append("<div class='value'>").append(escapeHtml(envName)).append("</div>")
            .append("</div>")
            .append("<div class='summary-card'>")
            .append("<div class='label'>Progress</div>")
            .append("<div class='value'>").append(execution.getPassedSteps()).append(" / ").append(execution.getTotalSteps()).append("</div>")
            .append("</div>")
            .append("</div>");

        // Error message if execution failed
        if (execution.getErrorMessage() != null && !execution.getErrorMessage().trim().isEmpty()) {
            html.append("<div class='error-box'>")
                .append("Execution Error: ").append(escapeHtml(execution.getErrorMessage()))
                .append("</div>");
        }

        // Steps Title
        html.append("<div class='section-title'>Execution Step Details</div>")
            .append("<div class='step-list'>");

        // Steps List
        for (ExecutionStepLog log : logs) {
            TestStep step = testStepRepository.findById(log.getTestStepId()).orElse(null);
            String stepName = step != null ? step.getName() : "Step ID: " + log.getTestStepId();
            String stepType = step != null ? step.getStepType().name() : "UNKNOWN";
            String logStatus = log.getStatus().name();
            String stepDuration = log.getDurationMs() != null ? log.getDurationMs() + "ms" : "--";

            html.append("<div class='step-card'>")
                .append("<div class='step-header'>")
                .append("<div class='step-info'>")
                .append("<span class='step-number'>#").append(log.getSequenceOrder()).append("</span>")
                .append("<span class='step-status-bullet ").append(getBulletClass(logStatus)).append("'></span>")
                .append("<span class='step-name'>").append(escapeHtml(stepName)).append("</span>")
                .append("<span class='step-type'>").append(stepType).append("</span>")
                .append("</div>")
                .append("<span class='step-duration'>").append(stepDuration).append("</span>")
                .append("</div>");

            if (log.getErrorMessage() != null && !log.getErrorMessage().trim().isEmpty()) {
                html.append("<div class='step-error'>")
                    .append("Error: ").append(escapeHtml(log.getErrorMessage()))
                    .append("</div>");
            }

            // Payloads
            boolean hasInput = log.getInputPayload() != null && !log.getInputPayload().trim().equals("{}") && !log.getInputPayload().trim().isEmpty();
            boolean hasOutput = log.getOutputPayload() != null && !log.getOutputPayload().trim().equals("{}") && !log.getOutputPayload().trim().isEmpty();
            
            if (hasInput || hasOutput) {
                html.append("<div class='step-payloads'>");
                if (hasInput) {
                    html.append("<div>")
                        .append("<div class='payload-title'>Resolved Input Payload</div>")
                        .append("<pre>").append(escapeHtml(formatJson(log.getInputPayload()))).append("</pre>")
                        .append("</div>");
                }
                if (hasOutput) {
                    html.append("<div>")
                        .append("<div class='payload-title'>Output Response</div>")
                        .append("<pre>").append(escapeHtml(formatJson(log.getOutputPayload()))).append("</pre>")
                        .append("</div>");
                }
                html.append("</div>");
            }

            html.append("</div>"); // Close step card
        }

        html.append("</div>") // Close step list
            .append("</div>") // Close content
            
            // Footer
            .append("<div class='footer'>")
            .append("<p>ORION Execution Platform — Report generated at ").append(formattedDate).append("</p>")
            .append("<p>Triggered by User ID: ").append(execution.getTriggeredBy()).append("</p>")
            .append("</div>")
            
            .append("</div>") // Close container
            .append("</body>")
            .append("</html>");

        return html.toString();
    }

    private String getStatusColor(String status) {
        return switch (status) {
            case "PASSED" -> "#10B981";
            case "FAILED" -> "#EF4444";
            case "RUNNING" -> "#3B82F6";
            case "QUEUED" -> "#F59E0B";
            default -> "#6B7280";
        };
    }

    private String getBadgeClass(String status) {
        return switch (status) {
            case "PASSED" -> "badge-passed";
            case "FAILED" -> "badge-failed";
            case "RUNNING" -> "badge-running";
            case "QUEUED" -> "badge-queued";
            default -> "badge-cancelled";
        };
    }

    private String getBulletClass(String status) {
        return switch (status) {
            case "PASSED" -> "bullet-passed";
            case "FAILED" -> "bullet-failed";
            case "RUNNING" -> "bullet-running";
            default -> "bullet-skipped";
        };
    }

    private String escapeHtml(String str) {
        if (str == null) return "";
        return str.replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\"", "&quot;")
                  .replace("'", "&#x27;");
    }

    private String formatJson(String json) {
        try {
            Object obj = objectMapper.readValue(json, Object.class);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (Exception e) {
            return json;
        }
    }

    public String getHtmlReport(String executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", executionId));

        TestCase testCase = testCaseRepository.findById(execution.getTestCaseId())
                .orElse(null);
        String testCaseName = testCase != null ? testCase.getName() : "Unknown TestCase";

        Environment env = execution.getEnvironmentId() != null
                ? environmentRepository.findById(execution.getEnvironmentId()).orElse(null)
                : null;
        String envName = env != null ? env.getName() : "Default / None";

        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(executionId);

        return generateHtmlReport(execution, testCaseName, envName, logs);
    }
}
