package com.axon.orion.admin.service;

import com.axon.orion.admin.entity.SystemSetting;
import com.axon.orion.admin.repository.SystemSettingRepository;
import com.axon.orion.audit.service.AuditService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemSettingsService {

    private final SystemSettingRepository systemSettingRepository;
    private final AuditService auditService;

    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private volatile boolean pendingRestart = false;

    @PostConstruct
    public void init() {
        log.info("Loading system settings from database into cache...");
        try {
            List<SystemSetting> settings = systemSettingRepository.findAll();
            for (SystemSetting setting : settings) {
                cache.put(setting.getSettingKey(), setting.getSettingValue());
            }
            log.info("Successfully cached {} system settings.", cache.size());
        } catch (Exception e) {
            log.error("Failed to load system settings from database: {}", e.getMessage());
        }
    }

    public String getString(String key, String defaultValue) {
        return cache.getOrDefault(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        String val = cache.get(key);
        if (val == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        String val = cache.get(key);
        if (val == null) {
            return defaultValue;
        }
        return Boolean.parseBoolean(val);
    }

    public List<SystemSetting> getSettingsByCategory(String category) {
        return systemSettingRepository.findByCategory(category);
    }

    public List<SystemSetting> getAllSettings() {
        return systemSettingRepository.findAll();
    }

    public boolean isPendingRestart() {
        return pendingRestart;
    }

    public void setPendingRestart(boolean pendingRestart) {
        this.pendingRestart = pendingRestart;
    }

    @Transactional
    public void updateSetting(String key, String newValue, String updatedBy) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key)
                .orElseThrow(() -> new IllegalArgumentException("System setting key not found: " + key));

        String oldValue = setting.getSettingValue();
        if (oldValue.equals(newValue)) {
            return;
        }

        setting.setSettingValue(newValue);
        setting.setUpdatedBy(updatedBy);
        systemSettingRepository.save(setting);

        // Update in-memory cache
        cache.put(key, newValue);

        // Record audit trail
        auditService.log("SYSTEM_SETTING", key, "UPDATE", updatedBy, oldValue, newValue);

        // Check if restart required
        if (setting.isRequiresRestart()) {
            pendingRestart = true;
            log.info("System setting '{}' updated. Requires system restart to take effect.", key);
        }
    }
}
