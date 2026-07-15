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
                Instant instant = execution.getStartedAt();
                formattedDate = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss UTC")
                        .withZone(ZoneId.of("UTC"))
                        .format(instant);
            } catch (Exception e) {
                formattedDate = execution.getStartedAt().toString();
            }
        }

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>")
            .append("<html>")
            .append("<head>")
            .append("<meta charset='utf-8'>")
            .append("<title>ORION Execution Report</title>")
            .append("<link rel='preconnect' href='https://fonts.googleapis.com'>")
            .append("<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>")
            .append("<link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' rel='stylesheet'>")
            .append("<style>")
            .append("body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #F8FAFC; color: #0F172A; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased; }")
            .append(".container { max-width: 900px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 10px 15px -3px rgba(0, 0, 0, 0.05); }")
            .append(".header { background: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%); color: #FFFFFF; padding: 40px; text-align: left; }")
            .append(".header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }")
            .append(".header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 15px; }")
            .append(".badge { display: inline-flex; align-items: center; padding: 6px 14px; font-weight: 700; font-size: 11px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }")
            .append(".badge-passed { background-color: #D1FAE5; color: #065F46; }")
            .append(".badge-failed { background-color: #FEE2E2; color: #991B1B; }")
            .append(".badge-running { background-color: #DBEAFE; color: #1E40AF; }")
            .append(".badge-queued { background-color: #FEF3C7; color: #92400E; }")
            .append(".badge-cancelled { background-color: #F1F5F9; color: #334155; }")
            .append(".content { padding: 40px; }")
            .append(".summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 35px; }")
            .append("@media (min-width: 600px) { .summary-grid { grid-template-columns: repeat(4, 1fr); } }")
            .append(".summary-card { padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0; background-color: #FFFFFF; transition: all 0.2s ease; }")
            .append(".summary-card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }")
            .append(".summary-card.status-passed { border-left: 4px solid #10B981; background-color: #F0FDF4; }")
            .append(".summary-card.status-failed { border-left: 4px solid #EF4444; background-color: #FEF2F2; }")
            .append(".summary-card.status-running { border-left: 4px solid #3B82F6; background-color: #EFF6FF; }")
            .append(".summary-card.status-queued { border-left: 4px solid #F59E0B; background-color: #FFFBEB; }")
            .append(".summary-card.status-cancelled { border-left: 4px solid #6B7280; background-color: #F8FAFC; }")
            .append(".summary-card .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 6px; letter-spacing: 0.05em; }")
            .append(".summary-card .value { font-size: 16px; font-weight: 800; color: #0F172A; }")
            .append(".error-box { background-color: #FEF2F2; border: 1px solid #FEE2E2; border-left: 4px solid #EF4444; padding: 20px; border-radius: 12px; color: #991B1B; font-size: 14.5px; font-weight: 600; margin-bottom: 35px; line-height: 1.5; }")
            .append(".section-title { font-size: 20px; font-weight: 800; color: #0F172A; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; letter-spacing: -0.02em; }")
            .append(".step-list { display: flex; flex-direction: column; gap: 16px; }")
            .append(".step-card { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background-color: #FFFFFF; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02); transition: all 0.2s ease; }")
            .append(".step-card:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border-color: #CBD5E1; }")
            .append(".step-card.expanded { border-color: #94A3B8; }")
            .append(".step-header { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; background-color: #FFFFFF; cursor: pointer; user-select: none; }")
            .append(".step-card.expanded .step-header { background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; }")
            .append(".step-info { display: flex; align-items: center; gap: 12px; }")
            .append(".step-number { font-size: 13px; font-weight: 700; color: #94A3B8; min-width: 24px; }")
            .append(".step-status-bullet { height: 10px; width: 10px; border-radius: 50%; display: inline-block; }")
            .append(".bullet-passed { background-color: #10B981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }")
            .append(".bullet-failed { background-color: #EF4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }")
            .append(".bullet-skipped { background-color: #94A3B8; }")
            .append(".bullet-running { background-color: #3B82F6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.4); }")
            .append(".step-name { font-size: 15px; font-weight: 600; color: #1F2937; }")
            .append(".step-type { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; background-color: #F1F5F9; padding: 3px 8px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }")
            .append(".step-duration { font-size: 13px; color: #64748B; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-right: 12px; }")
            .append(".chevron { width: 16px; height: 16px; color: #94A3B8; transition: transform 0.2s ease; }")
            .append(".step-card.expanded .chevron { transform: rotate(90deg); }")
            .append(".step-content { display: none; }")
            .append(".step-card.expanded .step-content { display: block; }")
            .append(".step-error { background-color: #FEF2F2; color: #991B1B; padding: 15px 20px; font-size: 13.5px; border-bottom: 1px solid #FEE2E2; font-weight: 500; line-height: 1.5; }")
            .append(".step-payloads { padding: 20px; background-color: #F8FAFC; display: flex; flex-direction: column; gap: 16px; }")
            .append(".payload-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }")
            .append("pre { margin: 0; background-color: #0F172A; color: #F8FAFC; padding: 16px; border-radius: 8px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; border: 1px solid #1E293B; line-height: 1.6; }")
            .append(".footer { text-align: center; padding: 30px; font-size: 13px; color: #64748B; border-top: 1px solid #E2E8F0; background-color: #F8FAFC; line-height: 1.6; }")
            .append(".db-table-wrapper { overflow-x: auto; border-radius: 8px; border: 1px solid #E2E8F0; margin-top: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }")
            .append(".db-table { width: 100%; border-collapse: collapse; font-size: 13px; background-color: #FFFFFF; }")
            .append(".db-table th { background-color: #1E293B; color: #F8FAFC; padding: 10px 14px; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid #334155; white-space: nowrap; }")
            .append(".db-table th:last-child { border-right: none; }")
            .append(".db-table td { padding: 9px 14px; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #334155; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }")
            .append(".db-table td:last-child { border-right: none; }")
            .append(".db-table tr:last-child td { border-bottom: none; }")
            .append(".db-table tr:nth-child(even) { background-color: #F8FAFC; }")
            .append(".db-table tr:hover { background-color: #FFFBEB; }")
            .append(".db-table-null { color: #94A3B8; font-style: italic; }")
            .append(".db-table-title { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }")
            .append(".db-row-count { font-size: 12px; color: #64748B; font-weight: 400; }")
            .append(".db-query-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 15px; margin-bottom: 6px; letter-spacing: 0.05em; }")
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
            .append("<div class='summary-card status-").append(status.toLowerCase()).append("'>")
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

            String cardClass = "step-card" + ("FAILED".equals(logStatus) ? " expanded" : "");
            html.append("<div class='").append(cardClass).append("'>")
                .append("<div class='step-header'>")
                .append("<div class='step-info'>")
                .append("<span class='step-number'>#").append(log.getSequenceOrder()).append("</span>")
                .append("<span class='step-status-bullet ").append(getBulletClass(logStatus)).append("'></span>")
                .append("<span class='step-name'>").append(escapeHtml(stepName)).append("</span>")
                .append("<span class='step-type'>").append(stepType).append("</span>")
                .append("</div>")
                .append("<div style='display:flex; align-items:center;'>")
                .append("<span class='step-duration'>").append(stepDuration).append("</span>")
                .append("<svg class='chevron' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'><path stroke-linecap='round' stroke-linejoin='round' d='M9 5l7 7-7 7'/></svg>")
                .append("</div>")
                .append("</div>")
                .append("<div class='step-content'>");

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
                    if ("DB_TABLE_VIEW".equals(stepType) || "DATABASE_QUERY".equals(stepType)) {
                        html.append(renderDbTableOutput(log.getOutputPayload()));
                    } else if ("BROWSER_AUTOMATION".equals(stepType)) {
                        html.append(renderBrowserAutomationOutput(log.getOutputPayload()));
                    } else {
                        html.append("<div>")
                            .append("<div class='payload-title'>Output Response</div>")
                            .append("<pre>").append(escapeHtml(formatJson(log.getOutputPayload()))).append("</pre>")
                            .append("</div>");
                    }
                }
                html.append("</div>");
            }

            html.append("</div>") // Close step-content
                .append("</div>"); // Close step card
        }

        html.append("</div>") // Close step list
            .append("</div>") // Close content
            
            // Footer
            .append("<div class='footer'>")
            .append("<p>ORION Execution Platform — Report generated at ").append(formattedDate).append("</p>")
            .append("<p>Triggered by User ID: ").append(execution.getTriggeredBy()).append("</p>")
            .append("</div>")
            
            .append("</div>") // Close container
            .append("<script>")
            .append("document.addEventListener('DOMContentLoaded', function() {")
            .append("  var headers = document.querySelectorAll('.step-header');")
            .append("  headers.forEach(function(header) {")
            .append("    header.addEventListener('click', function() {")
            .append("      var card = header.closest('.step-card');")
            .append("      card.classList.toggle('expanded');")
            .append("    });")
            .append("  });")
            .append("});")
            .append("</script>")
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

    @SuppressWarnings("unchecked")
    private String renderDbTableOutput(String outputPayload) {
        if (outputPayload == null || outputPayload.isBlank()) return "";
        try {
            java.util.Map<String, Object> output = objectMapper.readValue(outputPayload, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            java.util.List<java.util.Map<String, Object>> rows = (java.util.List<java.util.Map<String, Object>>) output.get("rows");

            if (rows == null) {
                // No rows key — fall back to JSON pre block
                return "<div><div class='payload-title'>Output Response</div><pre>" + escapeHtml(formatJson(outputPayload)) + "</pre></div>";
            }

            String tableTitle = (String) output.getOrDefault("tableTitle", null);
            Object rowCountObj = output.getOrDefault("rowCount", rows.size());
            int rowCount = rowCountObj instanceof Number ? ((Number) rowCountObj).intValue() : rows.size();
            String query = (String) output.getOrDefault("query", null);

            StringBuilder sb = new StringBuilder();
            sb.append("<div>");
            sb.append("<div class='db-table-title'>");
            sb.append("&#128202; "); // bar chart emoji as icon
            sb.append(escapeHtml(tableTitle != null ? tableTitle : "Query Results"));
            sb.append(" <span class='db-row-count'>(").append(rowCount).append(" rows)</span>");
            sb.append("</div>");

            if (rows.isEmpty()) {
                sb.append("<div style='color:#6B7280;font-size:12px;padding:10px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;'>No rows returned by query.</div>");
            } else {
                java.util.List<String> columns = new java.util.ArrayList<>(rows.get(0).keySet());
                sb.append("<div class='db-table-wrapper'><table class='db-table'><thead><tr>");
                for (String col : columns) {
                    sb.append("<th>").append(escapeHtml(col)).append("</th>");
                }
                sb.append("</tr></thead><tbody>");
                for (java.util.Map<String, Object> row : rows) {
                    sb.append("<tr>");
                    for (String col : columns) {
                        Object val = row.get(col);
                        if (val == null) {
                            sb.append("<td><span class='db-table-null'>NULL</span></td>");
                        } else {
                            sb.append("<td title='").append(escapeHtml(val.toString())).append("'>").append(escapeHtml(val.toString())).append("</td>");
                        }
                    }
                    sb.append("</tr>");
                }
                sb.append("</tbody></table></div>");
            }

            if (query != null && !query.isBlank()) {
                sb.append("<div class='db-query-label'>SQL Executed</div>")
                  .append("<pre>").append(escapeHtml(query)).append("</pre>");
            }

            sb.append("</div>");
            return sb.toString();
        } catch (Exception e) {
            log.warn("Failed to parse DB output payload for table rendering: {}", e.getMessage());
            return "<div><div class='payload-title'>Output Response</div><pre>" + escapeHtml(formatJson(outputPayload)) + "</pre></div>";
        }
    }

    @SuppressWarnings("unchecked")
    private String renderBrowserAutomationOutput(String outputPayload) {
        if (outputPayload == null || outputPayload.isBlank()) return "";
        try {
            java.util.Map<String, Object> output = objectMapper.readValue(outputPayload, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            java.util.List<java.util.Map<String, Object>> actions = (java.util.List<java.util.Map<String, Object>>) output.get("actions");
            java.util.List<java.util.Map<String, Object>> screenshots = (java.util.List<java.util.Map<String, Object>>) output.get("screenshots");

            StringBuilder sb = new StringBuilder();
            sb.append("<div style='display: flex; flex-direction: column; gap: 15px;'>");

            if (actions != null && !actions.isEmpty()) {
                sb.append("<div>");
                sb.append("<div class='payload-title'>Executed Automation Actions</div>");
                sb.append("<div style='background-color:#0F172A; color:#F8FAFC; border:1px solid #1E293B; padding:16px; border-radius:8px; font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; line-height:1.6;'>");
                for (java.util.Map<String, Object> action : actions) {
                    String status = (String) action.getOrDefault("status", "UNKNOWN");
                    String type = (String) action.getOrDefault("type", "");
                    String message = (String) action.getOrDefault("message", "");
                    String error = (String) action.getOrDefault("error", "");
                    String color = "SUCCESS".equals(status) ? "#10B981" : "#EF4444";

                    sb.append("<div style='margin-bottom: 6px; display:flex; align-items:center; gap: 8px;'>")
                      .append("<span style='color:").append(color).append("; font-weight:bold;'>[").append(status).append("]</span> ")
                      .append("<strong>").append(escapeHtml(type)).append("</strong>: ")
                      .append(escapeHtml(message.isEmpty() ? error : message))
                      .append("</div>");
                }
                sb.append("</div></div>");
            }

            if (screenshots != null && !screenshots.isEmpty()) {
                sb.append("<div>");
                sb.append("<div class='payload-title'>Captured Screenshots</div>");
                sb.append("<div class='screenshot-gallery' style='display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-top: 8px;'>");
                for (java.util.Map<String, Object> screenshot : screenshots) {
                    String name = (String) screenshot.getOrDefault("name", "screenshot");
                    String filename = (String) screenshot.getOrDefault("filename", "");
                    
                    String base64Image = "";
                    try {
                        java.nio.file.Path imagePath = java.nio.file.Paths.get("storage/screenshots", filename);
                        if (java.nio.file.Files.exists(imagePath)) {
                            byte[] fileContent = java.nio.file.Files.readAllBytes(imagePath);
                            base64Image = java.util.Base64.getEncoder().encodeToString(fileContent);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to encode screenshot file {} to base64: {}", filename, e.getMessage());
                    }

                    sb.append("<div style='border:1px solid #E2E8F0; border-radius:12px; overflow:hidden; background-color:#FFFFFF; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);'>");
                    if (!base64Image.isEmpty()) {
                        sb.append("<img src='data:image/png;base64,").append(base64Image)
                          .append("' alt='").append(escapeHtml(name))
                          .append("' style='width:100%; height:auto; display:block; border-bottom:1px solid #E2E8F0;' />");
                    } else {
                        sb.append("<div style='height:150px; background-color:#F1F5F9; display:flex; align-items:center; justify-content:center; color:#64748B; font-size:12px;'>Screenshot file missing</div>");
                    }
                    sb.append("<div style='padding:10px 8px; font-size:12px; font-weight:600; color:#334155; text-align:center;'>")
                      .append(escapeHtml(name))
                      .append("</div>");
                    sb.append("</div>");
                }
                sb.append("</div></div>");
            }

            sb.append("</div>");
            return sb.toString();
        } catch (Exception e) {
            log.warn("Failed to parse browser automation output: {}", e.getMessage());
            return "<div><div class='payload-title'>Output Response</div><pre>" + escapeHtml(formatJson(outputPayload)) + "</pre></div>";
        }
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

    public String generateJUnitXmlReport(String executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", executionId));

        TestCase testCase = testCaseRepository.findById(execution.getTestCaseId())
                .orElse(null);
        String testCaseName = testCase != null ? testCase.getName() : "Unknown TestCase";
        
        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(executionId);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        
        int total = logs.size();
        int failures = (int) logs.stream().filter(l -> l.getStatus() == ExecutionStepLog.Status.FAILED).count();
        double totalDurationSec = execution.getDurationMs() != null ? execution.getDurationMs() / 1000.0 : 0.0;
        
        xml.append(String.format("<testsuite name=\"%s\" tests=\"%d\" failures=\"%d\" errors=\"0\" time=\"%.3f\">\n",
                escapeXml(testCaseName), total, failures, totalDurationSec));
        
        for (ExecutionStepLog log : logs) {
            double stepDurationSec = log.getDurationMs() != null ? log.getDurationMs() / 1000.0 : 0.0;
            xml.append(String.format("  <testcase name=\"%s\" classname=\"%s\" time=\"%.3f\">\n",
                    escapeXml(log.getStepName()), escapeXml(testCaseName), stepDurationSec));
            
            if (log.getStatus() == ExecutionStepLog.Status.FAILED) {
                xml.append(String.format("    <failure message=\"%s\" type=\"AssertionFailedError\"><![CDATA[\n%s\n]]></failure>\n",
                        escapeXml(log.getErrorMessage() != null ? log.getErrorMessage() : "Step execution failed"),
                        log.getOutputPayload() != null ? log.getOutputPayload() : ""));
            }
            xml.append("  </testcase>\n");
        }
        
        xml.append("</testsuite>\n");
        return xml.toString();
    }

    private String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&apos;");
    }

    public String generateCsvReport(String executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", executionId));
        
        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(executionId);
        
        StringBuilder csv = new StringBuilder();
        csv.append("Step Sequence,Step Name,Step Type,Status,Duration (ms),Error Message\n");
        
        for (ExecutionStepLog log : logs) {
            csv.append(log.getSequenceOrder()).append(",")
               .append(escapeCsvField(log.getStepName())).append(",")
               .append(escapeCsvField(log.getStepType() != null ? log.getStepType() : "UNKNOWN")).append(",")
               .append(log.getStatus().name()).append(",")
               .append(log.getDurationMs() != null ? log.getDurationMs() : 0).append(",")
               .append(escapeCsvField(log.getErrorMessage())).append("\n");
        }
        return csv.toString();
    }

    private String escapeCsvField(String field) {
        if (field == null) return "";
        if (field.contains(",") || field.contains("\"") || field.contains("\n") || field.contains("\r")) {
            return "\"" + field.replace("\"", "\"\"") + "\"";
        }
        return field;
    }
}
