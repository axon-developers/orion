package com.axon.orion.tools.controller;

import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentDatabase;
import com.axon.orion.environment.entity.EnvironmentCertificate;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.execution.engine.ExecutionConnectionPool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.*;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/tools/db-validator")
@PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
@RequiredArgsConstructor
public class DatabaseQueryValidatorController {

    private final EnvironmentRepository environmentRepository;
    private final SystemSettingsService systemSettingsService;
    private final ExecutionConnectionPool connectionPool;
    private final EncryptionService encryptionService;

    @Data
    public static class QueryRequest {
        private String envId;
        private String databaseId;
        private String query;
    }

    @Data
    public static class QueryResponse {
        private boolean success;
        private String message;
        private Integer rowCount;
        private List<String> columns;
        private List<Map<String, Object>> rows;
        private String query;
    }

    @PostMapping("/query")
    public ResponseEntity<?> runQuery(@RequestBody QueryRequest request) {
        // 1. Check if tool is enabled by Admin
        boolean isEnabled = systemSettingsService.getBoolean("tools.db_query_validator.enabled", true);
        if (!isEnabled) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "Database Query Validator is disabled by the administrator.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(err);
        }

        // 2. Validate request params
        if (request.getEnvId() == null || request.getEnvId().isBlank()) {
            return ResponseEntity.badRequest().body(createErrorResponse("Environment ID is required."));
        }
        if (request.getDatabaseId() == null || request.getDatabaseId().isBlank()) {
            return ResponseEntity.badRequest().body(createErrorResponse("Database connection is required."));
        }
        if (request.getQuery() == null || request.getQuery().isBlank()) {
            return ResponseEntity.badRequest().body(createErrorResponse("SQL query is required."));
        }

        // 3. Read-only SQL safety check
        String rawQuery = request.getQuery();
        if (!isReadOnlyQuery(rawQuery)) {
            return ResponseEntity.badRequest().body(createErrorResponse(
                "Security restriction: Only read-only queries (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH) are allowed."
            ));
        }

        // 4. Resolve environment and database
        Optional<Environment> envOpt = environmentRepository.findById(request.getEnvId());
        if (envOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(createErrorResponse("Environment not found."));
        }
        Environment env = envOpt.get();

        EnvironmentDatabase targetDb = env.getDbConnections().stream()
                .filter(db -> request.getDatabaseId().equals(db.getId()) || request.getDatabaseId().equals(db.getName()))
                .findFirst()
                .orElse(null);

        if (targetDb == null) {
            return ResponseEntity.badRequest().body(createErrorResponse(
                "Database connection with key '" + request.getDatabaseId() + "' not found in environment " + env.getName()
            ));
        }

        // 5. Connect and Execute Query
        String connectionString = null;
        String username = targetDb.getUsername();
        String password = encryptionService.decrypt(targetDb.getPassword());
        String clientCertBase64 = null;
        String clientCertPassword = null;

        String type = (targetDb.getType() != null ? targetDb.getType() : "SQLITE").toUpperCase();
        String host = targetDb.getHost();
        Integer portNum = targetDb.getPort();
        String port = portNum != null ? String.valueOf(portNum) : "";
        String databaseName = targetDb.getDatabaseName();

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
                return ResponseEntity.badRequest().body(createErrorResponse("Unsupported database type: " + type));
            }
        }

        java.nio.file.Path tempCert = null;
        if (clientCertBase64 != null && !clientCertBase64.trim().isEmpty()) {
            try {
                String prefix = connectionString != null && connectionString.startsWith("jdbc:db2:") ? "orion_db2_" : "orion_db_";
                tempCert = java.nio.file.Files.createTempFile(prefix, ".p12");
                java.nio.file.Files.write(tempCert, Base64.getDecoder().decode(clientCertBase64.trim()));
            } catch (Exception e) {
                log.error("Failed to write temporary certificate file: {}", e.getMessage());
            }
        }

        if (tempCert != null) {
            String certLocation = tempCert.toAbsolutePath().toString();
            String certPlaceholder = targetDb.getCertPlaceholder();

            if (certPlaceholder != null && !certPlaceholder.isBlank()) {
                if (connectionString != null) connectionString = connectionString.replace(certPlaceholder, certLocation);
                if (username != null) username = username.replace(certPlaceholder, certLocation);
                if (password != null) password = password.replace(certPlaceholder, certLocation);
            }

            if (connectionString != null) connectionString = connectionString.replace("{{CERT_PATH}}", certLocation);
            if (username != null) username = username.replace("{{CERT_PATH}}", certLocation);
            if (password != null) password = password.replace("{{CERT_PATH}}", certLocation);
        }

        Connection conn = null;
        try {
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
                conn = connectionPool.getConnection(null, connectionString, null, null, props);
            } else {
                conn = connectionPool.getConnection(null, connectionString, username, password, null);
            }

            try (Statement stmt = conn.createStatement()) {
                // Limit query execution to prevent pulling massive results in client validator (max 200 rows)
                stmt.setMaxRows(200);

                boolean hasResultSet = stmt.execute(rawQuery);
                if (hasResultSet) {
                    try (ResultSet rs = stmt.getResultSet()) {
                        ResultSetMetaData md = rs.getMetaData();
                        int colCount = md.getColumnCount();
                        
                        List<String> columns = new ArrayList<>();
                        for (int i = 1; i <= colCount; i++) {
                            columns.add(md.getColumnLabel(i));
                        }

                        List<Map<String, Object>> rows = new ArrayList<>();
                        while (rs.next()) {
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (int i = 1; i <= colCount; i++) {
                                row.put(md.getColumnLabel(i), rs.getObject(i));
                            }
                            rows.add(row);
                        }

                        QueryResponse res = new QueryResponse();
                        res.setSuccess(true);
                        res.setRowCount(rows.size());
                        res.setColumns(columns);
                        res.setRows(rows);
                        res.setQuery(rawQuery);
                        return ResponseEntity.ok(res);
                    }
                } else {
                    QueryResponse res = new QueryResponse();
                    res.setSuccess(true);
                    res.setRowCount(0);
                    res.setColumns(Collections.emptyList());
                    res.setRows(Collections.emptyList());
                    res.setMessage("Query executed successfully. (No result set returned)");
                    res.setQuery(rawQuery);
                    return ResponseEntity.ok(res);
                }
            }
        } catch (Exception e) {
            log.error("Failed to run DB query validator: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("Database Error: " + e.getMessage()));
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (Exception e) {
                    log.error("Failed to close connection: {}", e.getMessage());
                }
            }
            if (tempCert != null) {
                try {
                    java.nio.file.Files.deleteIfExists(tempCert);
                } catch (Exception e) {
                    log.warn("Failed to delete temp cert file: {}", e.getMessage());
                }
            }
        }
    }

    private boolean isReadOnlyQuery(String query) {
        if (query == null) return false;
        String cleanQuery = query.trim().toLowerCase();

        // Strip single line comments
        cleanQuery = cleanQuery.replaceAll("--.*", "");
        // Strip block comments
        cleanQuery = cleanQuery.replaceAll("/\\*[\\s\\S]*?\\*/", "");
        cleanQuery = cleanQuery.trim();

        // Must start with a read-only command keyword
        if (!cleanQuery.startsWith("select") && !cleanQuery.startsWith("with") &&
            !cleanQuery.startsWith("show") && !cleanQuery.startsWith("describe") &&
            !cleanQuery.startsWith("explain") && !cleanQuery.startsWith("pragma")) {
            return false;
        }

        // Avoid modifying statements. Omit 'replace' keyword as it is a common string function.
        String regex = "\\b(insert|update|delete|drop|alter|truncate|merge|create|grant|revoke|into)\\b";
        Pattern pattern = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
        return !pattern.matcher(cleanQuery).find();
    }

    private QueryResponse createErrorResponse(String message) {
        QueryResponse res = new QueryResponse();
        res.setSuccess(false);
        res.setMessage(message);
        return res;
    }
}
