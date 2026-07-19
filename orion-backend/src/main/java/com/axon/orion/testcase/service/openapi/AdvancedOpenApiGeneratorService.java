package com.axon.orion.testcase.service.openapi;

import com.axon.orion.audit.service.AuditService;
import com.axon.orion.testcase.dto.*;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdvancedOpenApiGeneratorService {

    private final OpenApiSpecParser openApiSpecParser;
    private final UseCaseCartographer useCaseCartographer;
    private final CsvTemplateBuilder csvTemplateBuilder;
    private final AdvancedWorkflowBuilder advancedWorkflowBuilder;
    private final TestCaseRepository testCaseRepository;
    private final TestStepRepository testStepRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public GeneratorPreviewPayload analyzeSpec(MultipartFile file, AdvancedGeneratorOptions options) {
        if (options == null) {
            options = new AdvancedGeneratorOptions();
        }

        try {
            String filename = file.getOriginalFilename();
            boolean isYaml = filename != null && (filename.endsWith(".yaml") || filename.endsWith(".yml"));

            ObjectMapper mapper = isYaml ? new ObjectMapper(new YAMLFactory()) : objectMapper;
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);

            Map<String, Object> spec = mapper.readValue(content, new TypeReference<Map<String, Object>>() {});

            GeneratorPreviewPayload payload = new GeneratorPreviewPayload();
            payload.setOptions(options);

            // Extract Info
            Object infoObj = spec.get("info");
            if (infoObj instanceof Map) {
                Map<String, Object> info = (Map<String, Object>) infoObj;
                payload.setSpecTitle((String) info.getOrDefault("title", "OpenAPI Spec"));
                payload.setSpecVersion((String) info.getOrDefault("version", "1.0.0"));
            } else {
                payload.setSpecTitle("OpenAPI Spec");
                payload.setSpecVersion("1.0.0");
            }

            // Parse all operations
            List<ParsedOperation> allOps = openApiSpecParser.parse(spec);
            payload.setTotalOperationsFound(allOps.size());

            List<OperationPreview> opPreviews = new ArrayList<>();
            int totalUseCases = 0;
            Set<String> tagGroups = new HashSet<>();

            for (ParsedOperation op : allOps) {
                // Apply filter if specified
                if (options.getOperationFilter() != null && !options.getOperationFilter().isEmpty()) {
                    boolean matches = options.getOperationFilter().contains(op.getOperationId())
                            || options.getOperationFilter().contains(op.getRawPath());
                    if (!matches) continue;
                }

                OperationPreview opPreview = new OperationPreview();
                opPreview.setOperationId(op.getOperationId());
                opPreview.setMethod(op.getMethod());
                opPreview.setPath(op.getRawPath());
                opPreview.setSummary(op.getSummary());
                opPreview.setTags(op.getTags());
                opPreview.setIncluded(true);
                opPreview.setMultipart(op.isMultipart());

                tagGroups.addAll(op.getTags());

                if (op.isMultipart()) {
                    payload.getWarnings().add("Operation " + op.getMethod() + " " + op.getRawPath()
                            + " uses multipart/form-data. Step will be configured with FORM_DATA body type.");
                }

                // Generate Use Cases
                List<UseCaseRow> useCases = useCaseCartographer.generateUseCases(op, options);
                opPreview.setUseCases(useCases);
                opPreview.setSelectedCount(useCases.size());

                // Build CSV Template
                CsvTemplate csvTemplate = csvTemplateBuilder.buildTemplate(op, useCases);
                opPreview.setCsvTemplate(csvTemplate);

                // Build Column Variables Contract
                opPreview.setColumnVariables(buildColumnVariables(op, csvTemplate.getHeaders()));

                // Build Step Structure Summary
                opPreview.setStepStructure(buildStepStructure(op, useCases.size(), options));

                opPreviews.add(opPreview);
                totalUseCases += useCases.size();
            }

            payload.setOperations(opPreviews);
            payload.setTotalOperationsIncluded(opPreviews.size());
            payload.setTotalUseCasesGenerated(totalUseCases);
            payload.setTotalLoopIterations(totalUseCases);
            payload.setTotalStepsToCreate(opPreviews.size() * 5);

            // Compute estimated test cases count
            String groupBy = options.getGroupBy() != null ? options.getGroupBy() : "TAG";
            if ("SINGLE".equalsIgnoreCase(groupBy)) {
                payload.setEstimatedTestCasesCount(1);
            } else if ("OPERATION".equalsIgnoreCase(groupBy)) {
                payload.setEstimatedTestCasesCount(opPreviews.size());
            } else {
                // TAG
                payload.setEstimatedTestCasesCount(Math.max(1, tagGroups.size()));
            }

            return payload;

        } catch (IOException e) {
            log.error("Failed to analyze OpenAPI spec: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to read spec file: " + e.getMessage(), e);
        }
    }

    @Transactional
    public AdvancedGenerationResult generateFromPreview(
            String appId,
            GeneratorPreviewPayload payload,
            String userId) {

        AdvancedGenerationResult result = new AdvancedGenerationResult();
        if (payload == null || payload.getOperations() == null || payload.getOperations().isEmpty()) {
            result.getWarnings().add("No operations provided in preview payload");
            return result;
        }

        AdvancedGeneratorOptions options = payload.getOptions() != null ? payload.getOptions() : new AdvancedGeneratorOptions();
        String groupBy = options.getGroupBy() != null ? options.getGroupBy() : "TAG";

        // Group operations
        Map<String, List<OperationPreview>> groups = new LinkedHashMap<>();

        for (OperationPreview op : payload.getOperations()) {
            if (!op.isIncluded()) continue;

            // Check if any use-case is selected
            boolean hasSelectedUseCases = op.getUseCases() != null
                    && op.getUseCases().stream().anyMatch(UseCaseRow::isSelected);
            if (!hasSelectedUseCases) continue;

            if ("SINGLE".equalsIgnoreCase(groupBy)) {
                groups.computeIfAbsent(payload.getSpecTitle(), k -> new ArrayList<>()).add(op);
            } else if ("OPERATION".equalsIgnoreCase(groupBy)) {
                String key = op.getMethod() + " " + op.getPath();
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(op);
            } else {
                // TAG
                String primaryTag = (op.getTags() != null && !op.getTags().isEmpty())
                        ? op.getTags().get(0)
                        : "Untagged";
                groups.computeIfAbsent(primaryTag, k -> new ArrayList<>()).add(op);
            }
        }

        if (groups.isEmpty()) {
            result.getWarnings().add("All operations or use cases were deselected. No test cases created.");
            return result;
        }

        int totalTCs = 0;
        int totalSteps = 0;
        int totalUseCases = 0;

        for (Map.Entry<String, List<OperationPreview>> entry : groups.entrySet()) {
            String groupName = entry.getKey();
            List<OperationPreview> groupOps = entry.getValue();

            // Create TestCase
            TestCase tc = new TestCase();
            tc.setAppId(appId);
            tc.setName(payload.getSpecTitle() + " – " + groupName);
            tc.setDescription("Data-driven test suite generated from OpenAPI spec ("
                    + payload.getSpecTitle() + " v" + payload.getSpecVersion() + ") for group: " + groupName);
            tc.setTags("[\"imported\", \"openapi\", \"advanced\"]");
            tc.setPriority(TestCase.Priority.MEDIUM);
            tc.setStatus(TestCase.Status.DRAFT);
            tc.setCreatedBy(userId);

            TestCase savedTc = testCaseRepository.save(tc);
            totalTCs++;

            int seqOrder = 1;
            int tcStepCount = 0;
            int tcUseCaseCount = 0;
            boolean authStepCreated = false;

            for (OperationPreview op : groupOps) {
                boolean shouldCreateAuth = !authStepCreated;
                List<TestStep> steps = advancedWorkflowBuilder.buildStepsForOperation(savedTc.getId(), op, options, seqOrder, shouldCreateAuth);
                if (shouldCreateAuth && steps.stream().anyMatch(s -> s.getStepType() == TestStep.StepType.AUTH_TOKEN)) {
                    authStepCreated = true;
                }
                for (TestStep step : steps) {
                    testStepRepository.save(step);
                }
                seqOrder += steps.size();
                tcStepCount += steps.size();

                long selectedCount = op.getUseCases().stream().filter(UseCaseRow::isSelected).count();
                tcUseCaseCount += (int) selectedCount;
            }

            totalSteps += tcStepCount;
            totalUseCases += tcUseCaseCount;

            auditService.logCreate("TestCase", savedTc.getId(), userId, Map.of(
                    "name", savedTc.getName(),
                    "appId", appId,
                    "generatedSteps", tcStepCount
            ));

            GeneratedTestCaseSummary summary = new GeneratedTestCaseSummary();
            summary.setTestCaseId(savedTc.getId());
            summary.setName(savedTc.getName());
            summary.setTagGroup(groupName);
            summary.setStepCount(tcStepCount);
            summary.setUseCaseCount(tcUseCaseCount);

            result.getTestCases().add(summary);
        }

        result.setTestCasesCreated(totalTCs);
        result.setTotalStepsGenerated(totalSteps);
        result.setTotalUseCasesGenerated(totalUseCases);
        if (payload.getWarnings() != null) {
            result.getWarnings().addAll(payload.getWarnings());
        }

        return result;
    }

    private List<ColumnVariableInfo> buildColumnVariables(ParsedOperation op, List<String> headers) {
        List<ColumnVariableInfo> list = new ArrayList<>();
        for (String col : headers) {
            ColumnVariableInfo info = new ColumnVariableInfo();
            info.setColumnName(col);
            info.setPlaceholder("{{" + col + "}}");

            if ("usecase_name".equalsIgnoreCase(col)) {
                info.setUsedIn("Loop step name & Http step name");
                info.setDataType("string");
                info.setRequired(true);
            } else if ("expected_status_code".equalsIgnoreCase(col)) {
                info.setUsedIn("Assertion expectedValue");
                info.setDataType("integer");
                info.setRequired(true);
            } else {
                // Look up param or body field
                ParsedParam param = findParam(op, col);
                if (param != null) {
                    info.setUsedIn(param.getIn().toUpperCase() + " parameter");
                    info.setDataType(param.getType());
                    info.setRequired(param.isRequired());
                } else {
                    ParsedBodyField field = findBodyField(op, col);
                    if (field != null) {
                        info.setUsedIn("Request body: " + field.getName());
                        info.setDataType(field.getType());
                        info.setRequired(field.isRequired());
                    } else {
                        info.setUsedIn("Request parameter");
                        info.setDataType("string");
                        info.setRequired(false);
                    }
                }
            }
            list.add(info);
        }
        return list;
    }

    private ParsedParam findParam(ParsedOperation op, String name) {
        for (ParsedParam p : op.getPathParams()) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        for (ParsedParam p : op.getQueryParams()) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        for (ParsedParam p : op.getHeaderParams()) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        return null;
    }

    private ParsedBodyField findBodyField(ParsedOperation op, String name) {
        for (ParsedBodyField f : op.getBodyFields()) {
            if (f.getName().equalsIgnoreCase(name)) return f;
        }
        return null;
    }

    private OperationStepStructure buildStepStructure(ParsedOperation op, int loopCount, AdvancedGeneratorOptions options) {
        OperationStepStructure struct = new OperationStepStructure();
        struct.setStepCount(5);
        struct.setCsvExtractStepName("Test Data – " + op.getSummary());
        struct.setLoopStepName("Run All Use Cases – " + op.getMethod() + " " + op.getRawPath());
        struct.setLoopIterations(loopCount);
        struct.setHttpRequestStepNameTemplate("{{usecase_name}} – " + op.getMethod() + " " + op.getRawPath());
        struct.setAssertionStepNameTemplate("Verify status – {{usecase_name}}");
        struct.setBodyTemplate(constructJsonBodyTemplate(op));
        return struct;
    }

    private String constructJsonBodyTemplate(ParsedOperation op) {
        if (!op.isHasBody() || op.getBodyFields().isEmpty()) {
            return "{}";
        }

        if (op.isMultipart()) {
            Map<String, String> formData = new LinkedHashMap<>();
            for (ParsedBodyField f : op.getBodyFields()) {
                formData.put(f.getName(), "{{" + f.getName() + "}}");
            }
            try {
                return objectMapper.writeValueAsString(formData);
            } catch (Exception e) {
                return "{}";
            }
        }

        Map<String, Object> bodyMap = new LinkedHashMap<>();
        for (ParsedBodyField f : op.getBodyFields()) {
            bodyMap.put(f.getName(), "{{" + f.getName() + "}}");
        }

        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(bodyMap);
        } catch (Exception e) {
            return "{}";
        }
    }
}
