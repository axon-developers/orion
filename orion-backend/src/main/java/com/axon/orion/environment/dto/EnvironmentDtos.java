package com.axon.orion.environment.dto;

import com.axon.orion.environment.entity.Environment;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

public class EnvironmentDtos {

    @Data
    public static class EnvironmentVariable {
        @NotBlank(message = "Key is required")
        private String key;

        private String value;

        private boolean isSecret;

        private String description;
    }

    @Data
    public static class EnvironmentDto {
        private String id;
        private String appId;
        private String name;
        private String description;
        private List<EnvironmentVariableView> variables;
        private boolean isActive;
        private String createdBy;
        private String createdAt;
        private String updatedAt;
        private String sslClientCert;
        private String sslClientCertPassword;
        private boolean sslTrustAll;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EnvironmentVariableView {
        private String key;
        private String value; // masked as "***" if isSecret
        private boolean isSecret;
        private String description;
    }

    @Data
    public static class CreateEnvironmentRequest {
        @NotBlank(message = "Environment name is required")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        private String name;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;

        private List<EnvironmentVariable> variables;

        private String sslClientCert;
        private String sslClientCertPassword;
        private boolean sslTrustAll;
    }

    @Data
    public static class UpdateEnvironmentRequest {
        @NotBlank(message = "Environment name is required")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        private String name;

        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;

        private List<EnvironmentVariable> variables;

        private Boolean isActive;

        private String sslClientCert;
        private String sslClientCertPassword;
        private Boolean sslTrustAll;
    }
}
