package com.axon.orion.testcase.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class GeneratorPreviewPayload {
    private String appId;
    private String specTitle;
    private String specVersion;
    private AdvancedGeneratorOptions options;

    private int totalOperationsFound;
    private int totalOperationsIncluded;
    private int totalUseCasesGenerated;
    private int totalLoopIterations;
    private int totalStepsToCreate;
    private int estimatedTestCasesCount;

    private List<String> warnings = new ArrayList<>();
    private List<OperationPreview> operations = new ArrayList<>();
}
