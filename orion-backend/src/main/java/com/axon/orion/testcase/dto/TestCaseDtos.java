package com.axon.orion.testcase.dto;

import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

public class TestCaseDtos {

    @Data
    public static class TestCaseDto {
        private String id;
        private String appId;
        private String name;
        private String description;
        private List<String> tags;
        private String priority;
        private String status;
        private long stepCount;
        private String createdBy;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class TestCaseDetailDto extends TestCaseDto {
        private List<TestStepDto> steps;
    }

    @Data
    public static class CreateTestCaseRequest {
        @NotBlank(message = "Test case name is required")
        @Size(max = 200, message = "Name must not exceed 200 characters")
        private String name;

        @Size(max = 1000, message = "Description must not exceed 1000 characters")
        private String description;

        private List<String> tags;
        private TestCase.Priority priority = TestCase.Priority.MEDIUM;
        private TestCase.Status status = TestCase.Status.DRAFT;
    }

    @Data
    public static class UpdateTestCaseRequest {
        @NotBlank(message = "Test case name is required")
        @Size(max = 200, message = "Name must not exceed 200 characters")
        private String name;

        @Size(max = 1000, message = "Description must not exceed 1000 characters")
        private String description;

        private List<String> tags;
        private TestCase.Priority priority;
        private TestCase.Status status;
    }

    @Data
    public static class TestStepDto {
        private String id;
        private String testCaseId;
        private int sequenceOrder;
        private String name;
        private String description;
        private String stepType;
        private String actionType;
        private Object config;
        private String expectedResult;
        private boolean isGlobalRef;
        private String globalStepId;
        private boolean enabled = true;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class CreateTestStepRequest {
        @NotBlank(message = "Step name is required")
        private String name;

        private String description;

        @NotNull(message = "Step type is required")
        private TestStep.StepType stepType;

        private TestStep.ActionType actionType = TestStep.ActionType.NONE;

        private Object config;

        private String expectedResult;

        private boolean isGlobalRef = false;

        private String globalStepId;

        private boolean enabled = true;

        private Integer sequenceOrder;
    }

    @Data
    public static class ReorderRequest {
        @NotNull(message = "Step IDs are required")
        private List<String> stepIds;
    }

    @Data
    public static class BulkSaveRequest {
        @NotNull(message = "Steps are required")
        private List<CreateTestStepRequest> steps;
    }
}
