package com.axon.orion.testcase.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

public class TestSuiteDtos {

    @Data
    public static class TestSuiteDto {
        private String id;
        private String appId;
        private String name;
        private String description;
        private String cronExpression;
        private String environmentId;
        private boolean enabled;
        private boolean stopOnFailure;
        private int parallelism;
        private String createdBy;
        private List<String> testCaseIds;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class CreateTestSuiteRequest {
        @NotBlank(message = "Suite name is required")
        private String name;
        private String description;
        private String cronExpression;
        private String environmentId;
        private boolean enabled = true;
        private boolean stopOnFailure = false;
        private int parallelism = 1;
        private List<String> testCaseIds;
    }

    @Data
    public static class SuiteExecutionDto {
        private String id;
        private String suiteId;
        private String suiteName;
        private String status;
        private String triggeredBy;
        private String startedAt;
        private String completedAt;
        private Long durationMs;
        private int totalCases;
        private int passedCases;
        private int failedCases;
        private String errorMessage;
        private String createdAt;
        private List<SuiteExecutionCaseDto> cases;
    }

    @Data
    public static class SuiteExecutionCaseDto {
        private String id;
        private String testCaseId;
        private String testCaseName;
        private String executionId;
        private String status;
        private Long durationMs;
    }
}
