package com.axon.orion.admin.controller;

import com.axon.orion.admin.dto.AdminDtos;
import com.axon.orion.admin.entity.SystemSetting;
import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.audit.entity.AuditLog;
import com.axon.orion.audit.repository.AuditLogRepository;
import com.axon.orion.common.dto.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.user.entity.User;
import com.axon.orion.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
public class AdminSettingsController {

    private final SystemSettingsService systemSettingsService;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final ExecutionRepository executionRepository;
    private final AuditLogRepository auditLogRepository;
    private final ApplicationContext applicationContext;
    private final ObjectMapper objectMapper;

    @GetMapping("/api/admin/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PagedResponse<AuditLog>> getAuditLogs(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String performedBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<AuditLog> page_ = auditLogRepository.findAllWithFilters(
                (entityType == null || entityType.trim().isEmpty()) ? null : entityType.trim(),
                (performedBy == null || performedBy.trim().isEmpty()) ? null : performedBy.trim(),
                pageRequest
        );
        return ResponseEntity.ok(PagedResponse.of(
                page_.getContent(),
                page,
                size,
                page_.getTotalElements()
        ));
    }

    @GetMapping("/api/admin/settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AdminDtos.SystemSettingDto>> getSettings() {
        List<AdminDtos.SystemSettingDto> list = systemSettingsService.getAllSettings().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PutMapping("/api/admin/settings/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateSetting(
            @PathVariable String key,
            @RequestBody AdminDtos.UpdateSettingRequest request,
            @AuthenticationPrincipal User user) {
        systemSettingsService.updateSetting(key, request.getSettingValue(), user.getUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/admin/settings/public")
    public ResponseEntity<Map<String, String>> getPublicSettings() {
        Map<String, String> publicMap = new HashMap<>();
        publicMap.put("platform.name", systemSettingsService.getString("platform.name", "ORION"));
        publicMap.put("platform.tagline", systemSettingsService.getString("platform.tagline", "Visual Test Automation"));
        publicMap.put("ui.theme_default", systemSettingsService.getString("ui.theme_default", "dark"));
        publicMap.put("ui.sidebar_default_collapsed", systemSettingsService.getString("ui.sidebar_default_collapsed", "false"));
        publicMap.put("ui.dashboard_poll_interval_ms", systemSettingsService.getString("ui.dashboard_poll_interval_ms", "5000"));
        publicMap.put("ui.inactivity_timeout_minutes", systemSettingsService.getString("ui.inactivity_timeout_minutes", "15"));
        publicMap.put("ui.execution_page_version", systemSettingsService.getString("ui.execution_page_version", "v2"));
        publicMap.put("user.self_registration_enabled", systemSettingsService.getString("user.self_registration_enabled", "true"));
        return ResponseEntity.ok(publicMap);
    }

    @GetMapping("/api/admin/diagnostics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminDtos.SystemDiagnosticsDto> getDiagnostics() {
        AdminDtos.SystemDiagnosticsDto dto = new AdminDtos.SystemDiagnosticsDto();
        dto.setUptimeSeconds(ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        
        long totalMemory = Runtime.getRuntime().totalMemory();
        long freeMemory = Runtime.getRuntime().freeMemory();
        dto.setTotalMemoryBytes(totalMemory);
        dto.setFreeMemoryBytes(freeMemory);
        dto.setUsedMemoryBytes(totalMemory - freeMemory);

        dto.setTotalUsersCount(userRepository.count());
        dto.setTotalApplicationsCount(applicationRepository.count());
        dto.setTotalExecutionsCount(executionRepository.count());
        dto.setPendingRestart(systemSettingsService.isPendingRestart());

        // Default thread configuration values
        dto.setActiveExecutionsCount(0);
        dto.setMaxExecutionsConcurrency(systemSettingsService.getInt("execution.thread_pool_max_size", 1));
        dto.setQueuedExecutionsCount(0);

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/api/admin/maintenance/restart")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> restartApplication() {
        log.warn("ADMIN trigger graceful shutdown and restart process...");
        new Thread(() -> {
            try {
                Thread.sleep(1000);
                log.info("Exiting application with status 0.");
                SpringApplication.exit(applicationContext, () -> 0);
                System.exit(0);
            } catch (Exception e) {
                log.error("Failed to shutdown application cleanly: {}", e.getMessage());
            }
        }).start();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/api/admin/maintenance/purge-executions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> purgeExecutions() {
        int days = systemSettingsService.getInt("execution.auto_cleanup_days", 90);
        if (days <= 0) {
            return ResponseEntity.badRequest().build();
        }
        log.warn("Admin triggered execution purge for records older than {} days", days);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/admin/maintenance/clear-screenshots")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> clearScreenshots() {
        String pathStr = systemSettingsService.getString("execution.screenshot_storage_path", "storage/screenshots");
        log.warn("Admin triggered screenshots directory purge: {}", pathStr);
        try {
            Path folder = Paths.get(pathStr);
            if (Files.exists(folder)) {
                Files.walk(folder)
                        .filter(Files::isRegularFile)
                        .map(Path::toFile)
                        .forEach(File::delete);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to clear screenshot directory: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/admin/settings/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AdminDtos.SystemSettingDto>> exportSettings() {
        List<AdminDtos.SystemSettingDto> list = systemSettingsService.getAllSettings().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PostMapping("/api/admin/settings/import")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> importSettings(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        try {
            List<AdminDtos.SystemSettingDto> list = objectMapper.readValue(
                    file.getInputStream(),
                    new TypeReference<List<AdminDtos.SystemSettingDto>>() {}
            );
            for (AdminDtos.SystemSettingDto dto : list) {
                try {
                    systemSettingsService.updateSetting(dto.getSettingKey(), dto.getSettingValue(), user.getUsername());
                } catch (Exception e) {
                    log.warn("Failed to import key {}: {}", dto.getSettingKey(), e.getMessage());
                }
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Failed to parse settings JSON file: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    private AdminDtos.SystemSettingDto toDto(SystemSetting setting) {
        AdminDtos.SystemSettingDto dto = new AdminDtos.SystemSettingDto();
        dto.setId(setting.getId());
        dto.setCategory(setting.getCategory());
        dto.setSettingKey(setting.getSettingKey());
        dto.setSettingValue(setting.getSettingValue());
        dto.setValueType(setting.getValueType());
        dto.setDisplayName(setting.getDisplayName());
        dto.setDescription(setting.getDescription());
        dto.setRequiresRestart(setting.isRequiresRestart());
        dto.setUpdatedBy(setting.getUpdatedBy());
        dto.setUpdatedAt(setting.getUpdatedAt() != null ? setting.getUpdatedAt().toString() : "");
        return dto;
    }
}
