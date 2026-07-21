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

@Service
@RequiredArgsConstructor
public class SystemSettingsService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SystemSettingsService.class);

    private final SystemSettingRepository systemSettingRepository;
    private final AuditService auditService;

    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private volatile boolean pendingRestart = false;

    @PostConstruct
    public void init() {
        log.info("Loading system settings from database into cache...");
        try {
            // Programmatically check and seed tools configuration if missing
            checkAndSeedSetting("s44", "TOOLS", "tools.db_query_validator.enabled", "true", "BOOLEAN", "Enable Database Query Validator", "Allow users to validate read-only SQL queries against configured environment databases");
            checkAndSeedSetting("s45", "TOOLS", "tools.playwright_generator.enabled", "true", "BOOLEAN", "Enable Playwright Generator", "Allow users to record/generate Playwright step definitions within the browser automation tools");
            checkAndSeedSetting("s46", "GENERAL", "ui.notification_position", "top-right", "STRING", "Notification Position", "Standard 3x3 screen position matrix for rendering in-app toast notifications");
            checkAndSeedSetting("s54", "EXECUTION", "execution.browser_executor_engine", "PLAYWRIGHT_JAVA", "STRING", "Browser Automation Engine", "Execution engine for Browser Automation test steps: PLAYWRIGHT_JAVA (Default native Java runner) or CUCUMBER_JS (Node.js BDD scenario runner)");

            List<SystemSetting> settings = systemSettingRepository.findAll();
            for (SystemSetting setting : settings) {
                cache.put(setting.getSettingKey(), setting.getSettingValue());
            }
            log.info("Successfully cached {} system settings.", cache.size());
        } catch (Exception e) {
            log.error("Failed to load system settings from database: {}", e.getMessage());
        }
    }

    private void checkAndSeedSetting(String id, String category, String key, String value, String type, String displayName, String description) {
        try {
            var opt = systemSettingRepository.findBySettingKey(key);
            if (opt.isPresent()) {
                SystemSetting setting = opt.get();
                if (!category.equals(setting.getCategory())) {
                    setting.setCategory(category);
                    setting.setUpdatedAt(java.time.Instant.now());
                    systemSettingRepository.save(setting);
                    log.info("Enforced correct category '{}' for system setting: {}", category, key);
                }
            } else {
                SystemSetting setting = new SystemSetting();
                setting.setId(id);
                setting.setCategory(category);
                setting.setSettingKey(key);
                setting.setSettingValue(value);
                setting.setValueType(type);
                setting.setDisplayName(displayName);
                setting.setDescription(description);
                setting.setRequiresRestart(false);
                setting.setUpdatedBy("system");
                setting.setCreatedAt(java.time.Instant.now());
                setting.setUpdatedAt(java.time.Instant.now());
                systemSettingRepository.save(setting);
                log.info("Programmatically seeded missing system setting: {}", key);
            }
        } catch (Exception e) {
            log.warn("Failed to check/seed system setting {}: {}", key, e.getMessage());
        }
    }

    public String getString(String key, String defaultValue) {
        String val = cache.get(key);
        if (val != null && !val.isBlank()) {
            return val;
        }
        if ("proxy.host".equals(key)) {
            String envProxy = getEnvProxyValue("HTTP_PROXY");
            if (envProxy == null) envProxy = getEnvProxyValue("HTTPS_PROXY");
            if (envProxy != null) {
                return parseProxyHost(envProxy);
            }
        }
        if ("proxy.nonProxyHosts".equals(key)) {
            String envNoProxy = getEnvProxyValue("NO_PROXY");
            if (envNoProxy != null) {
                return envNoProxy;
            }
        }
        try {
            return systemSettingRepository.findBySettingKey(key)
                    .map(SystemSetting::getSettingValue)
                    .orElse(defaultValue);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public int getInt(String key, int defaultValue) {
        String val = cache.get(key);
        if (val != null && !val.isBlank()) {
            try {
                return Integer.parseInt(val);
            } catch (NumberFormatException ignored) {}
        }
        if ("proxy.port".equals(key)) {
            String envProxy = getEnvProxyValue("HTTP_PROXY");
            if (envProxy == null) envProxy = getEnvProxyValue("HTTPS_PROXY");
            if (envProxy != null) {
                int parsedPort = parseProxyPort(envProxy);
                if (parsedPort > 0) return parsedPort;
            }
        }
        try {
            return systemSettingRepository.findBySettingKey(key)
                    .map(s -> Integer.parseInt(s.getSettingValue()))
                    .orElse(defaultValue);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        String val = cache.get(key);
        if (val != null && !val.isBlank()) {
            return Boolean.parseBoolean(val);
        }
        if ("proxy.enabled".equals(key)) {
            String envProxy = getEnvProxyValue("HTTP_PROXY");
            if (envProxy == null) envProxy = getEnvProxyValue("HTTPS_PROXY");
            if (envProxy != null) {
                return true;
            }
        }
        try {
            return systemSettingRepository.findBySettingKey(key)
                    .map(s -> Boolean.parseBoolean(s.getSettingValue()))
                    .orElse(defaultValue);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private String getEnvProxyValue(String envName) {
        String val = System.getenv(envName);
        if (val != null && !val.isBlank()) return val.trim();
        val = System.getenv(envName.toLowerCase());
        if (val != null && !val.isBlank()) return val.trim();
        val = System.getenv(envName.toUpperCase());
        if (val != null && !val.isBlank()) return val.trim();
        return null;
    }

    private String parseProxyHost(String proxyUrl) {
        try {
            String temp = proxyUrl;
            if (temp.contains("://")) {
                temp = temp.substring(temp.indexOf("://") + 3);
            }
            if (temp.contains("@")) {
                temp = temp.substring(temp.indexOf("@") + 1);
            }
            if (temp.contains(":")) {
                temp = temp.substring(0, temp.indexOf(":"));
            }
            if (temp.contains("/")) {
                temp = temp.substring(0, temp.indexOf("/"));
            }
            return temp;
        } catch (Exception e) {
            return proxyUrl;
        }
    }

    private int parseProxyPort(String proxyUrl) {
        try {
            String temp = proxyUrl;
            if (temp.contains("://")) {
                temp = temp.substring(temp.indexOf("://") + 3);
            }
            if (temp.contains("@")) {
                temp = temp.substring(temp.indexOf("@") + 1);
            }
            if (temp.contains(":")) {
                String portStr = temp.substring(temp.indexOf(":") + 1);
                if (portStr.contains("/")) {
                    portStr = portStr.substring(0, portStr.indexOf("/"));
                }
                return Integer.parseInt(portStr);
            }
        } catch (Exception ignored) {}
        return 8080;
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
