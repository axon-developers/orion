package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentDataset;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.*;

@Slf4j
@Component
public class CsvExtractExecutor implements StepExecutor {

    private final EnvironmentRepository environmentRepository;

    public CsvExtractExecutor(EnvironmentRepository environmentRepository) {
        this.environmentRepository = environmentRepository;
    }

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.CSV_EXTRACT);
    }

    @Override
    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String datasetSource = (String) config.getOrDefault("datasetSource", "DESIGNER");
        String datasetName = (String) config.get("datasetName");
        String rawCsv = (String) config.get("rawCsv");
        String extractMode = (String) config.getOrDefault("extractMode", "FIRST_ROW");
        String variablePrefix = (String) config.get("variablePrefix");

        String csvContent = "";

        if ("ENVIRONMENT".equalsIgnoreCase(datasetSource)) {
            if (datasetName == null || datasetName.isBlank()) {
                return StepResult.failed("datasetName is required when datasetSource is ENVIRONMENT", Map.of());
            }
            String envId = context.get("__environmentId");
            if (envId == null || envId.isBlank()) {
                return StepResult.failed("Target environment is not specified in execution context", Map.of());
            }
            var envOpt = environmentRepository.findById(envId);
            if (envOpt.isEmpty()) {
                return StepResult.failed("Target environment not found for ID: " + envId, Map.of());
            }
            Environment env = envOpt.get();
            EnvironmentDataset targetDataset = env.getDatasets().stream()
                    .filter(d -> datasetName.equalsIgnoreCase(d.getName()) || datasetName.equalsIgnoreCase(d.getFilename()))
                    .findFirst()
                    .orElse(null);

            if (targetDataset == null) {
                return StepResult.failed("Dataset with key/name '" + datasetName + "' is not configured in environment " + env.getName(), Map.of());
            }
            csvContent = targetDataset.getCsvContent();
        } else {
            if (rawCsv == null || rawCsv.isBlank()) {
                return StepResult.failed("rawCsv content is required when datasetSource is DESIGNER", Map.of());
            }
            csvContent = rawCsv;
        }

        try {
            List<List<String>> csvRows = new ArrayList<>();
            try (BufferedReader br = new BufferedReader(new StringReader(csvContent))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    csvRows.add(parseCsvLine(line));
                }
            }

            if (csvRows.size() < 2) {
                return StepResult.failed("CSV content must contain at least a header row and one data row", Map.of());
            }

            List<String> headers = csvRows.get(0);
            List<List<String>> dataRows = csvRows.subList(1, csvRows.size());

            int selectedRowIdx = 0;
            if ("RANDOM_ROW".equalsIgnoreCase(extractMode)) {
                selectedRowIdx = new Random().nextInt(dataRows.size());
            } else if ("ITERATION_ROW".equalsIgnoreCase(extractMode)) {
                String idxStr = context.getOrDefault("__iterationIndex", context.getOrDefault("__loopIndex", "0"));
                try {
                    int loopIdx = Integer.parseInt(idxStr);
                    selectedRowIdx = loopIdx % dataRows.size();
                } catch (NumberFormatException e) {
                    selectedRowIdx = 0;
                }
            } else {
                selectedRowIdx = 0;
            }

            List<String> targetRow = dataRows.get(selectedRowIdx);
            Map<String, String> extractedVars = new LinkedHashMap<>();
            Map<String, Object> output = new LinkedHashMap<>();

            output.put("headers", headers);
            output.put("selectedRowIndex", selectedRowIdx + 1);
            output.put("rowData", targetRow);

            String prefix = (variablePrefix != null && !variablePrefix.trim().isEmpty()) 
                    ? variablePrefix.trim() + "." 
                    : "";

            for (int i = 0; i < headers.size(); i++) {
                String header = headers.get(i).trim();
                String value = i < targetRow.size() ? targetRow.get(i) : "";
                extractedVars.put(prefix + header, value);
            }

            for (Map.Entry<String, String> entry : extractedVars.entrySet()) {
                context.put(entry.getKey(), entry.getValue());
            }

            return StepResult.passed(output);

        } catch (Exception e) {
            log.error("Failed to extract CSV values: {}", e.getMessage(), e);
            return StepResult.failed("CSV extract error: " + e.getMessage(), Map.of());
        }
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        values.add(sb.toString().trim());
        return values;
    }
}
