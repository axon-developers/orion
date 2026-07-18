package com.axon.orion.testcase.service.openapi;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class CsvTemplateBuilder {

    public CsvTemplate buildTemplate(ParsedOperation op, List<UseCaseRow> useCases) {
        CsvTemplate template = new CsvTemplate();
        if (useCases == null || useCases.isEmpty()) {
            return template;
        }

        // 1. Extract ordered header list
        List<String> headers = new ArrayList<>();
        headers.add("usecase_name");
        headers.add("expected_status_code");

        for (ParsedParam p : op.getPathParams()) {
            if (!headers.contains(p.getName())) headers.add(p.getName());
        }
        for (ParsedParam p : op.getQueryParams()) {
            if (!headers.contains(p.getName())) headers.add(p.getName());
        }
        for (ParsedBodyField f : op.getBodyFields()) {
            if (!headers.contains(f.getName())) headers.add(f.getName());
        }

        template.setHeaders(headers);

        // 2. Build rows
        List<CsvTemplateRow> csvRows = new ArrayList<>();
        StringBuilder csvSb = new StringBuilder();

        // Write Header line to CSV
        csvSb.append(String.join(",", headers.stream().map(this::escapeCsv).toList())).append("\n");

        for (UseCaseRow ucRow : useCases) {
            CsvTemplateRow row = new CsvTemplateRow();
            row.setUsecaseName(ucRow.getUsecaseName());
            row.setSelected(ucRow.isSelected());

            List<String> lineValues = new ArrayList<>();
            for (String header : headers) {
                String val = ucRow.getValues().getOrDefault(header, "");
                row.getValues().put(header, val);
                lineValues.add(escapeCsv(val));
            }

            csvRows.add(row);
            csvSb.append(String.join(",", lineValues)).append("\n");
        }

        template.setRows(csvRows);
        template.setRawCsv(csvSb.toString());

        return template;
    }

    private String escapeCsv(String input) {
        if (input == null) return "";
        if (input.contains(",") || input.contains("\"") || input.contains("\n") || input.contains("\r")) {
            return "\"" + input.replace("\"", "\"\"") + "\"";
        }
        return input;
    }
}
