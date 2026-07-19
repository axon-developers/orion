package com.axon.orion.testcase.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AdvancedGenerationResult {
    private int testCasesCreated;
    private int totalStepsGenerated;
    private int totalUseCasesGenerated;
    private List<GeneratedTestCaseSummary> testCases = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
}
