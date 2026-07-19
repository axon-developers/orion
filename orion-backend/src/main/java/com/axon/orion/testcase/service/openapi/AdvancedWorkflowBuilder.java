package com.axon.orion.testcase.service.openapi;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.dto.AdvancedGeneratorOptions;
import com.axon.orion.testcase.dto.ColumnVariableInfo;
import com.axon.orion.testcase.dto.OperationPreview;
import com.axon.orion.testcase.entity.TestStep;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdvancedWorkflowBuilder {

    private final ObjectMapper objectMapper;

    public List<TestStep> buildStepsForOperation(
            String testCaseId,
            OperationPreview opPreview,
            AdvancedGeneratorOptions options,
            int startSequenceOrder) {
        return buildStepsForOperation(testCaseId, opPreview, options, startSequenceOrder, true);
    }

    public List<TestStep> buildStepsForOperation(
            String testCaseId,
            OperationPreview opPreview,
            AdvancedGeneratorOptions options,
            int startSequenceOrder,
            boolean includeAuthStep) {

        List<TestStep> steps = new ArrayList<>();

        // Filter only selected use-case rows
        List<UseCaseRow> selectedUseCases = opPreview.getUseCases().stream()
                .filter(UseCaseRow::isSelected)
                .toList();

        if (selectedUseCases.isEmpty()) {
            return steps;
        }

        int currentSeq = startSequenceOrder;
        String authVar = options.getAuthHeaderVariable() != null && !options.getAuthHeaderVariable().isBlank()
                ? options.getAuthHeaderVariable()
                : "authToken";
        boolean strictStatus = options.isStrictStatusCode();

        // ── 1. AUTH_TOKEN Step (1 single auth step per test case) ────────────
        if (includeAuthStep) {
            int authSeq = currentSeq++;
            TestStep authStep = new TestStep();
            authStep.setTestCaseId(testCaseId);
            authStep.setSequenceOrder(authSeq);
            authStep.setName("Generate Auth Token – " + opPreview.getSummary());
            authStep.setDescription("Generates OAuth2 authentication token and stores in {{" + authVar + "}}");
            authStep.setStepType(TestStep.StepType.AUTH_TOKEN);
            authStep.setActionType(TestStep.ActionType.NONE);
            authStep.setEnabled(true);

            Map<String, Object> authConfig = new LinkedHashMap<>();
            authConfig.put("authType", "OAUTH2_CLIENT_CREDENTIALS");
            authConfig.put("targetVariable", authVar);
            authConfig.put("tokenUrl", "{{baseUrl}}/oauth/token");
            authConfig.put("clientId", "{{clientId}}");
            authConfig.put("clientSecret", "{{clientSecret}}");
            authStep.setConfig(VariableInterpolator.toJson(authConfig));
            steps.add(authStep);
        }

        int csvSeq = currentSeq++;
        int loopSeq = currentSeq++;
        int httpSeq = currentSeq++;
        int assertSeq = currentSeq++;

        // Build raw CSV string for selected rows
        String rawCsv = buildCsvForSelectedRows(opPreview, selectedUseCases);

        // ── 2. CSV_EXTRACT Step ───────────────────────────────────────────────
        TestStep csvStep = new TestStep();
        csvStep.setTestCaseId(testCaseId);
        csvStep.setSequenceOrder(csvSeq);
        csvStep.setName("Test Data – " + opPreview.getSummary());
        csvStep.setDescription("Inlined data-driven CSV scenarios for " + opPreview.getMethod() + " " + opPreview.getPath());
        csvStep.setStepType(TestStep.StepType.CSV_EXTRACT);
        csvStep.setActionType(TestStep.ActionType.NONE);
        csvStep.setEnabled(true);

        Map<String, Object> csvConfig = new LinkedHashMap<>();
        csvConfig.put("datasetSource", "DESIGNER");
        csvConfig.put("rawCsv", rawCsv);
        csvConfig.put("extractMode", "ITERATION_ROW");
        csvStep.setConfig(VariableInterpolator.toJson(csvConfig));
        steps.add(csvStep);

        // ── 3. LOOP Step ──────────────────────────────────────────────────────
        TestStep loopStep = new TestStep();
        loopStep.setTestCaseId(testCaseId);
        loopStep.setSequenceOrder(loopSeq);
        loopStep.setName("Run All Use Cases – " + opPreview.getMethod() + " " + opPreview.getPath());
        loopStep.setDescription("Executes request & assertion steps across " + selectedUseCases.size() + " data rows");
        loopStep.setStepType(TestStep.StepType.LOOP);
        loopStep.setActionType(TestStep.ActionType.NONE);
        loopStep.setEnabled(true);

        Map<String, Object> loopConfig = new LinkedHashMap<>();
        loopConfig.put("type", "COUNT");
        loopConfig.put("count", selectedUseCases.size());
        loopConfig.put("steps", List.of(httpSeq, assertSeq));
        loopConfig.put("continueOnFailure", true);
        loopStep.setConfig(VariableInterpolator.toJson(loopConfig));
        steps.add(loopStep);

        // ── 4. HTTP_REQUEST Step ──────────────────────────────────────────────
        TestStep httpStep = new TestStep();
        httpStep.setTestCaseId(testCaseId);
        httpStep.setSequenceOrder(httpSeq);
        httpStep.setName("{{usecase_name}} – " + opPreview.getMethod() + " " + opPreview.getPath());
        httpStep.setDescription("HTTP Request step inside loop");
        httpStep.setStepType(TestStep.StepType.HTTP_REQUEST);
        httpStep.setActionType(TestStep.ActionType.NONE);
        httpStep.setEnabled(true);

        Map<String, Object> httpConfig = new LinkedHashMap<>();
        httpConfig.put("method", opPreview.getMethod());

        // Construct URL with query parameters placeholder if any query params present
        String url = constructUrl(opPreview);
        httpConfig.put("url", url);

        // Headers
        Map<String, String> headers = new LinkedHashMap<>();
        String contentType = opPreview.isMultipart() ? "multipart/form-data" : "application/json";
        headers.put("Content-Type", contentType);
        headers.put("Authorization", "{{" + authVar + "}}");
        httpConfig.put("headers", headers);

        // Body
        String bodyType = opPreview.isMultipart() ? "FORM_DATA" : "JSON";
        String bodyContent = opPreview.getStepStructure() != null && opPreview.getStepStructure().getBodyTemplate() != null
                ? opPreview.getStepStructure().getBodyTemplate()
                : "{}";

        if ("GET".equalsIgnoreCase(opPreview.getMethod()) || "DELETE".equalsIgnoreCase(opPreview.getMethod())) {
            bodyType = "NONE";
            bodyContent = "";
        }

        httpConfig.put("bodyType", bodyType);
        httpConfig.put("body", bodyContent);
        httpConfig.put("timeoutMs", 30000);

        httpStep.setConfig(VariableInterpolator.toJson(httpConfig));
        steps.add(httpStep);

        // ── 5. ASSERTION Step ─────────────────────────────────────────────────
        TestStep assertStep = new TestStep();
        assertStep.setTestCaseId(testCaseId);
        assertStep.setSequenceOrder(assertSeq);
        assertStep.setName("Verify status – {{usecase_name}}");
        assertStep.setDescription("Validates response status code for each iteration");
        assertStep.setStepType(TestStep.StepType.ASSERTION);
        assertStep.setActionType(TestStep.ActionType.NONE);
        assertStep.setEnabled(true);

        Map<String, Object> assertConfig = new LinkedHashMap<>();
        assertConfig.put("targetField", "STATUS_CODE");

        if (strictStatus) {
            assertConfig.put("operator", "EQUALS");
            assertConfig.put("expectedValue", "{{expected_status_code}}");
        } else {
            // Default 2XX check: status >= 200 AND < 300
            assertConfig.put("operator", "GREATER_THAN_OR_EQUAL");
            assertConfig.put("expectedValue", "200");
            assertConfig.put("secondaryOperator", "LESS_THAN");
            assertConfig.put("secondaryExpectedValue", "300");
        }

        assertStep.setConfig(VariableInterpolator.toJson(assertConfig));
        steps.add(assertStep);

        return steps;
    }

    private String buildCsvForSelectedRows(OperationPreview opPreview, List<UseCaseRow> selectedUseCases) {
        if (opPreview.getCsvTemplate() == null || opPreview.getCsvTemplate().getHeaders().isEmpty()) {
            return "usecase_name,expected_status_code\nbase_case,200\n";
        }

        List<String> headers = opPreview.getCsvTemplate().getHeaders();
        StringBuilder csvSb = new StringBuilder();

        // Write Header
        csvSb.append(String.join(",", headers.stream().map(this::escapeCsv).toList())).append("\n");

        for (UseCaseRow row : selectedUseCases) {
            List<String> lineValues = new ArrayList<>();
            for (String header : headers) {
                String val = row.getValues().getOrDefault(header, "");
                lineValues.add(escapeCsv(val));
            }
            csvSb.append(String.join(",", lineValues)).append("\n");
        }

        return csvSb.toString();
    }

    private String constructUrl(OperationPreview opPreview) {
        String rawPath = opPreview.getPath().replaceAll("\\{([^}]+)\\}", "{{$1}}");
        String url = "{{baseUrl}}" + rawPath;

        List<String> queryParams = new ArrayList<>();
        if (opPreview.getColumnVariables() != null) {
            for (ColumnVariableInfo var : opPreview.getColumnVariables()) {
                if ("Query parameter".equalsIgnoreCase(var.getUsedIn())) {
                    queryParams.add(var.getColumnName() + "={{" + var.getColumnName() + "}}");
                }
            }
        }

        if (!queryParams.isEmpty()) {
            url += "?" + String.join("&", queryParams);
        }

        return url;
    }

    private String escapeCsv(String input) {
        if (input == null) return "";
        if (input.contains(",") || input.contains("\"") || input.contains("\n") || input.contains("\r")) {
            return "\"" + input.replace("\"", "\"\"") + "\"";
        }
        return input;
    }
}
