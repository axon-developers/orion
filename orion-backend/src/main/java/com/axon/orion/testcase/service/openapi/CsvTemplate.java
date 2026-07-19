package com.axon.orion.testcase.service.openapi;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class CsvTemplate {
    private List<String> headers = new ArrayList<>();
    private List<CsvTemplateRow> rows = new ArrayList<>();
    private String rawCsv;
}
