package com.axon.orion.global_step.dto;

import com.axon.orion.global_step.entity.GlobalTestStep;
import com.axon.orion.testcase.entity.TestStep;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

public class GlobalTestStepDtos {

    @Data
    public static class GlobalTestStepDto {
        private String id;
        private String name;
        private String description;
        private String stepType;
        private String actionType;
        private Object config;
        private String createdBy;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class CreateGlobalTestStepRequest {
        @NotBlank(message = "Step name is required")
        private String name;

        private String description;

        @NotNull(message = "Step type is required")
        private TestStep.StepType stepType;

        private TestStep.ActionType actionType = TestStep.ActionType.NONE;

        private Object config;
    }

    public static GlobalTestStepDto toDto(GlobalTestStep step) {
        GlobalTestStepDto dto = new GlobalTestStepDto();
        dto.setId(step.getId());
        dto.setName(step.getName());
        dto.setDescription(step.getDescription());
        dto.setStepType(step.getStepType().name());
        dto.setActionType(step.getActionType().name());
        dto.setCreatedBy(step.getCreatedBy());
        dto.setCreatedAt(step.getCreatedAt());
        dto.setUpdatedAt(step.getUpdatedAt());
        try {
            dto.setConfig(new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(step.getConfig() != null ? step.getConfig() : "{}", Object.class));
        } catch (Exception e) {
            dto.setConfig(new java.util.HashMap<>());
        }
        return dto;
    }
}
