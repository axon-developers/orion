package com.axon.orion.testcase.dto;

import com.axon.orion.testcase.service.openapi.CsvTemplate;
import com.axon.orion.testcase.service.openapi.UseCaseRow;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OperationPreview {
    private String operationId;
    private String method;
    private String path;
    private String summary;
    private List<String> tags = new ArrayList<>();
    private boolean included = true;
    private boolean isMultipart = false;

    private List<UseCaseRow> useCases = new ArrayList<>();
    private int selectedCount;

    private CsvTemplate csvTemplate;
    private List<ColumnVariableInfo> columnVariables = new ArrayList<>();
    private OperationStepStructure stepStructure;
}
