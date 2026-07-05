package com.axon.orion.execution.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Slf4j
@Component
public class ExecutionConnectionPool {

    // Map of executionId -> (Map of connection key -> Connection)
    private final Map<String, Map<String, Connection>> pools = new ConcurrentHashMap<>();

    public Connection getConnection(
            String executionId,
            String connectionString,
            String username,
            String password,
            Properties dbProps
    ) throws Exception {
        if (executionId == null) {
            return createConnection(connectionString, username, password, dbProps);
        }

        Map<String, Connection> execPool = pools.computeIfAbsent(executionId, k -> new ConcurrentHashMap<>());

        // Build a unique key for the connection settings
        String connKey = connectionString + "|" + (username != null ? username : "");

        Connection conn = execPool.get(connKey);
        if (conn == null || conn.isClosed()) {
            synchronized (execPool) {
                conn = execPool.get(connKey);
                if (conn == null || conn.isClosed()) {
                    conn = createConnection(connectionString, username, password, dbProps);
                    execPool.put(connKey, conn);
                    log.info("Opened new pooled connection for execution {} and key {}", executionId, connKey);
                }
            }
        } else {
            log.debug("Reused pooled connection for execution {} and key {}", executionId, connKey);
        }

        return conn;
    }

    private Connection createConnection(String connectionString, String username, String password, Properties dbProps) throws Exception {
        if (dbProps != null) {
            return DriverManager.getConnection(connectionString, dbProps);
        }
        if (username != null && !username.isBlank()) {
            return DriverManager.getConnection(connectionString, username, password);
        }
        return DriverManager.getConnection(connectionString);
    }

    public void closeConnections(String executionId) {
        if (executionId == null) return;
        Map<String, Connection> execPool = pools.remove(executionId);
        if (execPool != null) {
            for (Map.Entry<String, Connection> entry : execPool.entrySet()) {
                try {
                    Connection conn = entry.getValue();
                    if (conn != null && !conn.isClosed()) {
                        conn.close();
                        log.info("Closed pooled connection for execution {} and key {}", executionId, entry.getKey());
                    }
                } catch (Exception e) {
                    log.error("Failed to close pooled connection for execution {}: {}", executionId, e.getMessage());
                }
            }
        }
    }
}
