package com.axon.orion.application.dto;

import com.axon.orion.application.entity.Application;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

public class ApplicationDtos {

    @Data
    public static class ApplicationDto {
        private String id;
        private String appId;
        private String name;
        private String appName;
        private String prId;
        private String plId;
        private String owner;
        private String description;
        private boolean isActive;
        private String createdBy;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class ApplicationSummaryDto extends ApplicationDto {
        private long environmentCount;
        private long testCaseCount;
        private long executionCount;
    }

    @Data
    public static class CreateApplicationRequest {
        private String name; // backward compatibility
        
        @NotBlank(message = "appName is required")
        @Size(max = 100, message = "appName must not exceed 100 characters")
        private String appName;

        @NotBlank(message = "appId is required")
        @Size(min = 8, max = 8, message = "appId must be exactly 8 characters")
        @Pattern(regexp = "^[A-Z0-9]{8}$", message = "appId must be 8 alphanumeric uppercase characters")
        private String appId;

        @NotBlank(message = "prId is required")
        @Size(min = 8, max = 8, message = "prId must be exactly 8 characters")
        @Pattern(regexp = "^[A-Z0-9]{8}$", message = "prId must be 8 alphanumeric uppercase characters")
        private String prId;

        @NotBlank(message = "plId is required")
        @Size(min = 8, max = 8, message = "plId must be exactly 8 characters")
        @Pattern(regexp = "^[A-Z0-9]{8}$", message = "plId must be 8 alphanumeric uppercase characters")
        private String plId;

        @NotBlank(message = "owner is required")
        private String owner;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;

        public String getResolvedName() {
            return appName != null && !appName.isBlank() ? appName : name;
        }

        public void sanitize() {
            if (appId != null) appId = appId.trim().toUpperCase();
            if (prId != null) prId = prId.trim().toUpperCase();
            if (plId != null) plId = plId.trim().toUpperCase();
        }
    }

    @Data
    public static class UpdateApplicationRequest {
        private String name; // backward compatibility
        
        private String appName;
        
        @Size(min = 8, max = 8, message = "prId must be exactly 8 characters")
        @Pattern(regexp = "^[A-Z0-9]{8}$", message = "prId must be 8 alphanumeric uppercase characters")
        private String prId;

        @Size(min = 8, max = 8, message = "plId must be exactly 8 characters")
        @Pattern(regexp = "^[A-Z0-9]{8}$", message = "plId must be 8 alphanumeric uppercase characters")
        private String plId;

        private String owner;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;
        private Boolean isActive;

        public String getResolvedName() {
            return appName != null && !appName.isBlank() ? appName : name;
        }

        public void sanitize() {
            if (prId != null) prId = prId.trim().toUpperCase();
            if (plId != null) plId = plId.trim().toUpperCase();
        }
    }

    public static ApplicationDto toDto(Application app) {
        ApplicationDto dto = new ApplicationDto();
        dto.setId(app.getId());
        dto.setAppId(app.getId());
        dto.setName(app.getName());
        dto.setAppName(app.getName());
        dto.setPrId(app.getPrId());
        dto.setPlId(app.getPlId());
        dto.setOwner(app.getOwner());
        dto.setDescription(app.getDescription());
        dto.setActive(app.isActive());
        dto.setCreatedBy(app.getCreatedBy());
        dto.setCreatedAt(app.getCreatedAt() != null ? app.getCreatedAt().toString() : null);
        dto.setUpdatedAt(app.getUpdatedAt() != null ? app.getUpdatedAt().toString() : null);
        return dto;
    }
}
