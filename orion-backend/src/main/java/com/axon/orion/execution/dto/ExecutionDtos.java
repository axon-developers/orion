package com.axon.orion.execution.dto;

import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

public class ExecutionDtos {

    @Data
    public static class EmailReportRequest {
        @NotBlank(message = "Recipient email is required")
        @jakarta.validation.constraints.Email(message = "Invalid email format")
        private String recipientEmail;
    }

    @Data
    public static class TriggerExecutionRequest {
        @NotBlank(message = "Test case ID is required")
        private String testCaseId;

        @NotBlank(message = "Environment ID is required")
        private String environmentId;

        private List<String> stepIds;
    }

    @Data
    public static class ExecutionDto {
        private String id;
        private String testCaseId;
        private String testCaseName;
        private String environmentId;
        private String environmentName;
        private String status;
        private String triggeredBy;
        private String startedAt;
        private String completedAt;
        private Long durationMs;
        private int totalSteps;
        private int passedSteps;
        private int failedSteps;
        private String errorMessage;
        private List<String> stepIds;
        private String createdAt;
    }

    @Data
    public static class ExecutionDetailDto extends ExecutionDto {
        private List<ExecutionStepLogDto> stepLogs;
    }

    @Data
    public static class ExecutionStepLogDto {
        private String id;
        private String executionId;
        private String testStepId;
        private String stepName;
        private String stepType;
        private String iterationLabel;
        private int sequenceOrder;
        private String status;
        private Object inputPayload;
        private Object outputPayload;
        private String errorMessage;
        private String startedAt;
        private String completedAt;
        private Long durationMs;
    }

    @Data
    public static class ExecutionStatsDto {
        private long totalExecutions;
        private long passedExecutions;
        private long failedExecutions;
        private long runningExecutions;
        private double passRate;
        private double avgDurationMs;
    }

    @Data
    public static class ExecutionTrendDto {
        private String date;
        private long passed;
        private long failed;
    }

    public static ExecutionDto toDto(Execution exec) {
        ExecutionDto dto = new ExecutionDto();
        dto.setId(exec.getId());
        dto.setTestCaseId(exec.getTestCaseId());
        dto.setEnvironmentId(exec.getEnvironmentId());
        dto.setStatus(exec.getStatus().name());
        dto.setTriggeredBy(exec.getTriggeredBy());
        dto.setStartedAt(exec.getStartedAt() != null ? exec.getStartedAt().toString() : null);
        dto.setCompletedAt(exec.getCompletedAt() != null ? exec.getCompletedAt().toString() : null);
        dto.setDurationMs(exec.getDurationMs());
        dto.setTotalSteps(exec.getTotalSteps());
        dto.setPassedSteps(exec.getPassedSteps());
        dto.setFailedSteps(exec.getFailedSteps());
        dto.setErrorMessage(exec.getErrorMessage());
        if (exec.getStepIds() != null && !exec.getStepIds().isBlank()) {
            dto.setStepIds(java.util.Arrays.asList(exec.getStepIds().split(",")));
        }
        dto.setCreatedAt(exec.getCreatedAt() != null ? exec.getCreatedAt().toString() : null);
        return dto;
    }

    public static ExecutionStepLogDto toStepLogDto(ExecutionStepLog log) {
        ExecutionStepLogDto dto = new ExecutionStepLogDto();
        dto.setId(log.getId());
        dto.setExecutionId(log.getExecutionId());
        dto.setTestStepId(log.getTestStepId());
        dto.setStepName(log.getStepName());
        dto.setStepType(log.getStepType());
        dto.setIterationLabel(log.getIterationLabel());
        dto.setSequenceOrder(log.getSequenceOrder());
        dto.setStatus(log.getStatus().name());
        dto.setErrorMessage(log.getErrorMessage());
        dto.setStartedAt(log.getStartedAt() != null ? log.getStartedAt().toString() : null);
        dto.setCompletedAt(log.getCompletedAt() != null ? log.getCompletedAt().toString() : null);
        dto.setDurationMs(log.getDurationMs());
        try {
            var om = new com.fasterxml.jackson.databind.ObjectMapper();
            dto.setInputPayload(om.readValue(
                    log.getInputPayload() != null ? log.getInputPayload() : "{}", Object.class));
            dto.setOutputPayload(om.readValue(
                    log.getOutputPayload() != null ? log.getOutputPayload() : "{}", Object.class));
        } catch (Exception e) {
            dto.setInputPayload(new java.util.HashMap<>());
            dto.setOutputPayload(new java.util.HashMap<>());
        }
        return dto;
    }
}
