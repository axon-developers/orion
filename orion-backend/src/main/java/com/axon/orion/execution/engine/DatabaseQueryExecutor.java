package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.entity.EnvironmentDatabase;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.testcase.entity.TestStep;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.axon.orion.common.service.EncryptionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

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
 
    public DatabaseQueryExecutor(
            EnvironmentRepository environmentRepository,
            ObjectMapper objectMapper,
            ExecutionConnectionPool connectionPool,
            EncryptionService encryptionService
    ) {
        this.environmentRepository = environmentRepository;
        this.objectMapper = objectMapper;
        this.connectionPool = connectionPool;
        this.encryptionService = encryptionService;
    }

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
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
 
            String certificateKey = targetDb.getCertificateKey();
            if (certificateKey != null && !certificateKey.isBlank()) {
                EnvironmentCertificate targetCert = env.getCertificates().stream()
                        .filter(c -> certificateKey.equals(c.getName()) || certificateKey.equals(c.getId()))
                        .findFirst()
                        .orElse(null);
 
                if (targetCert != null) {
                    clientCertBase64 = targetCert.getClientCert();
                    clientCertPassword = encryptionService.decrypt(targetCert.getClientCertPassword());
                }
            }

            // Fallback to environment default certificate
            if (clientCertBase64 == null || clientCertBase64.isBlank()) {
                clientCertBase64 = env.getSslClientCert();
                clientCertPassword = encryptionService.decrypt(env.getSslClientCertPassword());
            }

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

        java.nio.file.Path tempCert = null;
        if (clientCertBase64 != null && !clientCertBase64.trim().isEmpty()) {
            try {
                String prefix = connectionString != null && connectionString.startsWith("jdbc:db2:") ? "orion_db2_" : "orion_db_";
                tempCert = java.nio.file.Files.createTempFile(prefix, ".p12");
                java.nio.file.Files.write(tempCert, Base64.getDecoder().decode(clientCertBase64.trim()));
            } catch (Exception e) {
                log.error("Failed to write temporary certificate file for database connection: {}", e.getMessage());
            }
        }

        if (tempCert != null) {
            String certLocation = tempCert.toAbsolutePath().toString();
            String certPlaceholder = null;
            if (targetDb != null) {
                certPlaceholder = targetDb.getCertPlaceholder();
            }

            if (certPlaceholder != null && !certPlaceholder.isBlank()) {
                if (connectionString != null) connectionString = connectionString.replace(certPlaceholder, certLocation);
                if (username != null) username = username.replace(certPlaceholder, certLocation);
                if (password != null) password = password.replace(certPlaceholder, certLocation);
            }

            // Fallback default placeholder {{CERT_PATH}}
            if (connectionString != null) connectionString = connectionString.replace("{{CERT_PATH}}", certLocation);
            if (username != null) username = username.replace("{{CERT_PATH}}", certLocation);
            if (password != null) password = password.replace("{{CERT_PATH}}", certLocation);
        }

        Connection conn = null;
        try {
            String executionId = context.get("__executionId");
            if (tempCert != null && connectionString != null && connectionString.startsWith("jdbc:db2:")) {
                Properties props = new Properties();
                props.setProperty("user", username != null ? username : "");
                props.setProperty("password", password != null ? password : "");
                props.setProperty("sslConnection", "true");
                String certPath = tempCert.toAbsolutePath().toString();
                String certPass = clientCertPassword != null ? clientCertPassword : "";
                props.setProperty("sslTrustStoreLocation", certPath);
                props.setProperty("sslTrustStorePassword", certPass);
                props.setProperty("sslTrustStoreType", "PKCS12");
                props.setProperty("sslKeyStoreLocation", certPath);
                props.setProperty("sslKeyStorePassword", certPass);
                props.setProperty("sslKeyStoreType", "PKCS12");
                conn = connectionPool.getConnection(executionId, connectionString, null, null, props);
            } else {
                conn = connectionPool.getConnection(executionId, connectionString, username, password, null);
            }
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
}
