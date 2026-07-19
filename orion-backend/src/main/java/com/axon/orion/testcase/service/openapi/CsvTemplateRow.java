package com.axon.orion.testcase.service.openapi;

import lombok.Data;
import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class CsvTemplateRow {
    private String usecaseName;
    private Map<String, String> values = new LinkedHashMap<>();
    private boolean selected = true;
}
