package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.entity.EnvironmentDatabase;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.admin.service.SystemSettingsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.axon.orion.common.service.EncryptionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.security.KeyStore;
import java.sql.*;
import java.util.*;

@Slf4j
@Component
public class DatabaseQueryExecutor implements StepExecutor {

    @Override
    public Set<TestStep.StepType> supportedTypes() {
        return Set.of(TestStep.StepType.DATABASE_QUERY, TestStep.StepType.DB_TABLE_VIEW);
    }

    private final EnvironmentRepository environmentRepository;
    private final ObjectMapper objectMapper;
    private final ExecutionConnectionPool connectionPool;
    private final EncryptionService encryptionService;
    private final SystemSettingsService systemSettingsService;
 
    public DatabaseQueryExecutor(
            EnvironmentRepository environmentRepository,
            ObjectMapper objectMapper,
            ExecutionConnectionPool connectionPool,
            EncryptionService encryptionService,
            SystemSettingsService systemSettingsService
    ) {
        this.environmentRepository = environmentRepository;
        this.objectMapper = objectMapper;
        this.connectionPool = connectionPool;
        this.encryptionService = encryptionService;
        this.systemSettingsService = systemSettingsService;
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        boolean proxySet = false;
        boolean socksCredsSet = false;
        if (systemSettingsService.getBoolean("proxy.enabled", false) 
                && "SOCKS5".equalsIgnoreCase(systemSettingsService.getString("proxy.type", "HTTP"))) {
            String host = systemSettingsService.getString("proxy.host", "");
            String port = String.valueOf(systemSettingsService.getInt("proxy.port", 8080));
            if (!host.isBlank()) {
                System.setProperty("socksProxyHost", host);
                System.setProperty("socksProxyPort", port);
                proxySet = true;
                log.info("Configured JVM SOCKS proxy: {}:{}", host, port);
            }
            String username = systemSettingsService.getString("proxy.username", "");
            String password = systemSettingsService.getString("proxy.password", "");
            if (!username.isBlank()) {
                System.setProperty("java.net.socks.username", username);
                System.setProperty("java.net.socks.password", password);
                socksCredsSet = true;
            }
        }

        String connectionString = null;
        String username = null;
        String password = null;

        String databaseKey = (String) config.get("databaseKey");
        com.axon.orion.environment.entity.Environment env = null;
        EnvironmentDatabase targetDb = null;
        String clientCertBase64 = null;
        String clientCertPassword = null;

        if (databaseKey != null && !databaseKey.isBlank()) {
            String envId = context.get("__environmentId");
            if (envId == null || envId.isBlank()) {
                return StepResult.failed("Target environment is not specified in execution context for database key lookup", Map.of());
            }

            var envOpt = environmentRepository.findById(envId);
            if (envOpt.isEmpty()) {
                return StepResult.failed("Target environment not found for ID: " + envId, Map.of());
            }

            env = envOpt.get();
            
            targetDb = env.getDbConnections().stream()
                    .filter(db -> databaseKey.equals(db.getName()) || databaseKey.equals(db.getId()))
                    .findFirst()
                    .orElse(null);
 
            if (targetDb == null) {
                return StepResult.failed("Database connection with key '" + databaseKey + "' is not configured in environment " + env.getName(), Map.of());
            }
 
            String type = (targetDb.getType() != null ? targetDb.getType() : "SQLITE").toUpperCase();
            String host = targetDb.getHost();
            Integer portNum = targetDb.getPort();
            String port = portNum != null ? String.valueOf(portNum) : "";
            String databaseName = targetDb.getDatabaseName();
            username = targetDb.getUsername();
            password = encryptionService.decrypt(targetDb.getPassword());
 
            String customUrl = targetDb.getConnectionUrl();
            if (customUrl != null && !customUrl.isBlank()) {
                connectionString = com.axon.orion.common.util.DbUrlHelper.normalize(customUrl);
            } else {
                if ("POSTGRESQL".equals(type) || "COCKROACHDB".equals(type)) {
                    connectionString = String.format("jdbc:postgresql://%s:%s/%s", host, port, databaseName);
                } else if ("MYSQL".equals(type)) {
                    connectionString = String.format("jdbc:mysql://%s:%s/%s", host, port, databaseName);
                } else if ("ORACLE".equals(type)) {
                    connectionString = String.format("jdbc:oracle:thin:@//%s:%s/%s", host, port, databaseName);
                } else if ("DB2".equals(type)) {
                    connectionString = String.format("jdbc:db2://%s:%s/%s", host, port, databaseName);
                } else if ("SQLITE".equals(type)) {
                    connectionString = String.format("jdbc:sqlite:%s?busy_timeout=5000", databaseName);
                } else {
                    return StepResult.failed("Unsupported database type: " + type, Map.of());
                }
            }
        } else {
            connectionString = com.axon.orion.common.util.DbUrlHelper.normalize(
                VariableInterpolator.resolve((String) config.get("connectionString"), context)
            );
        }

        String query = VariableInterpolator.resolve((String) config.get("query"), context);
        String resultVariable = (String) config.get("resultVariable");

        if (connectionString == null || connectionString.isBlank()) {
            return StepResult.failed("databaseKey or connectionString is required for DATABASE_QUERY step", Map.of());
        }
        if (query == null || query.isBlank()) {
            return StepResult.failed("query is required for DATABASE_QUERY step", Map.of());
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("query", query);
        boolean printAsTable = step.getStepType() == TestStep.StepType.DB_TABLE_VIEW 
                || Boolean.TRUE.equals(config.get("printAsTable"));
        output.put("printAsTable", printAsTable);
        output.put("tableTitle", config.getOrDefault("tableTitle", ""));

        Connection conn = null;
        try {
            String executionId = context.get("__executionId");
            conn = connectionPool.getConnection(executionId, connectionString, username, password, null);
            try (Statement stmt = conn.createStatement()) {
                
                boolean hasResultSet = stmt.execute(query);
                if (hasResultSet) {
                    try (ResultSet rs = stmt.getResultSet()) {
                        ResultSetMetaData md = rs.getMetaData();
                        int columns = md.getColumnCount();
                        List<Map<String, Object>> rows = new ArrayList<>();
                        
                        while (rs.next()) {
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (int i = 1; i <= columns; i++) {
                                row.put(md.getColumnLabel(i), rs.getObject(i));
                            }
                            rows.add(row);
                        }
                        output.put("rows", rows);
                        output.put("rowCount", rows.size());

                        if (resultVariable != null && !resultVariable.isBlank()) {
                            // Store the first column of the first row, or JSON if multiple rows
                            String val = "";
                            if (!rows.isEmpty()) {
                                Object firstVal = rows.get(0).values().iterator().next();
                                val = firstVal != null ? firstVal.toString() : "";
                            }
                            return StepResult.withVariable(resultVariable, val, output);
                        }
                    }
                } else {
                    int updateCount = stmt.getUpdateCount();
                    output.put("updateCount", updateCount);
                    if (resultVariable != null && !resultVariable.isBlank()) {
                        return StepResult.withVariable(resultVariable, String.valueOf(updateCount), output);
                    }
                }
                return StepResult.passed(output);
            }
        } catch (Exception e) {
            log.error("Failed to execute database query: {}", e.getMessage());
            return StepResult.failed("Database error: " + e.getMessage(), output);
        } finally {
            if (proxySet) {
                System.clearProperty("socksProxyHost");
                System.clearProperty("socksProxyPort");
                log.info("Cleared JVM SOCKS proxy configuration");
            }
            if (socksCredsSet) {
                System.clearProperty("java.net.socks.username");
                System.clearProperty("java.net.socks.password");
            }
            String executionId = context.get("__executionId");
            if (executionId == null && conn != null) {
                try {
                    conn.close();
                } catch (Exception e) {
                    log.error("Failed to close database connection: {}", e.getMessage());
                }
            }
            if (tempCert != null) {
                try {
                    java.nio.file.Files.deleteIfExists(tempCert);
                } catch (Exception e) {
                    log.warn("Failed to delete temp certificate file: {}", e.getMessage());
                }
            }
        }
    }

    private String detectKeyStoreType(String clientCertBase64, String clientCertPassword) {
        if (clientCertBase64 == null || clientCertBase64.isBlank()) {
            return "PKCS12";
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(clientCertBase64.trim());
            char[] pass = clientCertPassword != null ? clientCertPassword.toCharArray() : new char[0];
            KeyStore ks = KeyStore.getInstance("PKCS12");
            try (ByteArrayInputStream bis = new ByteArrayInputStream(bytes)) {
                ks.load(bis, pass);
                return "PKCS12";
            }
        } catch (Exception e) {
            try {
                byte[] bytes = Base64.getDecoder().decode(clientCertBase64.trim());
                char[] pass = clientCertPassword != null ? clientCertPassword.toCharArray() : new char[0];
                KeyStore ks = KeyStore.getInstance("JKS");
                try (ByteArrayInputStream bis = new ByteArrayInputStream(bytes)) {
                    ks.load(bis, pass);
                    return "JKS";
                }
            } catch (Exception ex) {
                return "PKCS12";
            }
        }
    }
}
