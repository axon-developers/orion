package com.axon.orion.testcase.dto;

import lombok.Data;

@Data
public class OperationStepStructure {
    private int stepCount = 4;
    private String csvExtractStepName;
    private String loopStepName;
    private int loopIterations;
    private String httpRequestStepNameTemplate;
    private String assertionStepNameTemplate;
    private String bodyTemplate;
}
