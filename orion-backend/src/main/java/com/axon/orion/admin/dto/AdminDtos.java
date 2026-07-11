package com.axon.orion.admin.dto;

import lombok.Data;

public class AdminDtos {

    @Data
    public static class SystemSettingDto {
        private String id;
        private String category;
        private String settingKey;
        private String settingValue;
        private String valueType;
        private String displayName;
        private String description;
        private boolean requiresRestart;
        private String updatedBy;
        private String updatedAt;
    }

    @Data
    public static class UpdateSettingRequest {
        private String settingValue;
    }

    @Data
    public static class SystemDiagnosticsDto {
        private long uptimeSeconds;
        private long totalMemoryBytes;
        private long freeMemoryBytes;
        private long usedMemoryBytes;
        private int activeExecutionsCount;
        private int maxExecutionsConcurrency;
        private int queuedExecutionsCount;
        private long totalUsersCount;
        private long totalApplicationsCount;
        private long totalExecutionsCount;
        private boolean pendingRestart;
    }

    @Data
    public static class LogEntryDto {
        private String timestamp;
        private String thread;
        private String level;
        private String logger;
        private String message;
        private String rawLine;
    }
}
