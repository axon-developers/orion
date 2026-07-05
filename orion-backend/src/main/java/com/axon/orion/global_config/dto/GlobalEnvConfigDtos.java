package com.axon.orion.global_config.dto;

import com.axon.orion.global_config.entity.GlobalEnvConfig;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class GlobalEnvConfigDtos {

    @Data
    public static class GlobalEnvConfigDto {
        private String id;
        private String configKey;
        private String configValue; // masked if isSecret
        private String description;
        private boolean isSecret;
        private String createdBy;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class CreateGlobalEnvConfigRequest {
        @NotBlank(message = "Config key is required")
        @Size(max = 100, message = "Key must not exceed 100 characters")
        private String configKey;

        @NotBlank(message = "Config value is required")
        private String configValue;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;

        private boolean isSecret = false;
    }

    @Data
    public static class UpdateGlobalEnvConfigRequest {
        @NotBlank(message = "Config value is required")
        private String configValue;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;

        private Boolean isSecret;
    }

    public static GlobalEnvConfigDto toDto(GlobalEnvConfig config, boolean maskSecrets) {
        GlobalEnvConfigDto dto = new GlobalEnvConfigDto();
        dto.setId(config.getId());
        dto.setConfigKey(config.getConfigKey());
        dto.setConfigValue(maskSecrets && config.isSecret() ? "***" : config.getConfigValue());
        dto.setDescription(config.getDescription());
        dto.setSecret(config.isSecret());
        dto.setCreatedBy(config.getCreatedBy());
        dto.setCreatedAt(config.getCreatedAt() != null ? config.getCreatedAt().toString() : null);
        dto.setUpdatedAt(config.getUpdatedAt() != null ? config.getUpdatedAt().toString() : null);
        return dto;
    }
}
