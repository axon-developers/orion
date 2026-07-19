package com.axon.orion.testcase.dto;

import lombok.Data;

@Data
public class GeneratedTestCaseSummary {
    private String testCaseId;
    private String name;
    private String tagGroup;
    private int stepCount;
    private int useCaseCount;
}
