package com.axon.orion.admin.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/admin/database")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminDatabaseController {

    private final DataSource dataSource;

    @Data
    public static class SqlQueryRequest {
        private String query;
    }

    @Data
    public static class SqlQueryResponse {
        private boolean success;
        private String message;
        private List<String> columns;
        private List<Map<String, Object>> rows;
        private Integer rowCount;
        private Integer affectedRows;
    }

    @Data
    public static class TableSchemaResponse {
        private String tableName;
        private List<ColumnMeta> columns;
    }

    @Data
    public static class ColumnMeta {
        private String columnName;
        private String dataType;
        private int columnSize;
        private boolean nullable;
    }

    /**
     * Lists all tables in the Orion internal database.
     */
    @GetMapping("/tables")
    public ResponseEntity<List<String>> listTables() {
        List<String> tables = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Query for tables of type "TABLE"
            String[] types = {"TABLE"};
            try (ResultSet rs = metaData.getTables(null, null, "%", types)) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    // Filter out internal flyway schema history or system metadata if needed, but let admin see everything
                    tables.add(tableName);
                }
            }
            Collections.sort(tables);
            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            log.error("Failed to list database tables: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieves column details and types for a specific table.
     */
    @GetMapping("/tables/{tableName}/schema")
    public ResponseEntity<TableSchemaResponse> getTableSchema(@PathVariable String tableName) {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Verify if table exists first by checking metadata case insensitively
            boolean tableExists = false;
            String exactTableName = tableName;
            try (ResultSet rs = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    String tName = rs.getString("TABLE_NAME");
                    if (tName.equalsIgnoreCase(tableName)) {
                        exactTableName = tName;
                        tableExists = true;
                        break;
                    }
                }
            }

            if (!tableExists) {
                return ResponseEntity.notFound().build();
            }

            List<ColumnMeta> columns = new ArrayList<>();
            try (ResultSet rs = metaData.getColumns(null, null, exactTableName, "%")) {
                while (rs.next()) {
                    ColumnMeta col = new ColumnMeta();
                    col.setColumnName(rs.getString("COLUMN_NAME"));
                    col.setDataType(rs.getString("TYPE_NAME"));
                    col.setColumnSize(rs.getInt("COLUMN_SIZE"));
                    col.setNullable("YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")));
                    columns.add(col);
                }
            }

            TableSchemaResponse schema = new TableSchemaResponse();
            schema.setTableName(exactTableName);
            schema.setColumns(columns);
            return ResponseEntity.ok(schema);
        } catch (Exception e) {
            log.error("Failed to fetch schema for table {}: {}", tableName, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Executes arbitrary SQL query against the Orion configured database datasource.
     */
    @PostMapping("/query")
    public ResponseEntity<SqlQueryResponse> runQuery(@RequestBody SqlQueryRequest request) {
        SqlQueryResponse response = new SqlQueryResponse();
        
        if (request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            response.setSuccess(false);
            response.setMessage("SQL query is required.");
            return ResponseEntity.badRequest().body(response);
        }

        String rawQuery = request.getQuery().trim();
        log.info("Admin database query execution triggered: {}", rawQuery);

        try (Connection conn = dataSource.getConnection()) {
            // Check query type: SELECT, SHOW, PRAGMA, EXPLAIN or modifications
            boolean isSelectOrShow = startsWithReadOnlyKeyword(rawQuery);

            try (Statement stmt = conn.createStatement()) {
                if (isSelectOrShow) {
                    // Execute query
                    // Limit query max rows to avoid out-of-memory for massive tables
                    stmt.setMaxRows(1000);
                    
                    try (ResultSet rs = stmt.executeQuery(rawQuery)) {
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

                        response.setSuccess(true);
                        response.setColumns(columns);
                        response.setRows(rows);
                        response.setRowCount(rows.size());
                        response.setMessage("Query executed successfully. Returned " + rows.size() + " rows.");
                    }
                } else {
                    // Update query (INSERT, UPDATE, DELETE, CREATE, DROP, etc.)
                    int affected = stmt.executeUpdate(rawQuery);
                    response.setSuccess(true);
                    response.setAffectedRows(affected);
                    response.setMessage("Update executed successfully. Affected rows: " + affected);
                }
            }
            return ResponseEntity.ok(response);
        } catch (SQLException e) {
            log.warn("SQL Exception executed by admin: {}", e.getMessage());
            response.setSuccess(false);
            response.setMessage("SQL Database Error: " + e.getMessage() + " (State: " + e.getSQLState() + ", Code: " + e.getErrorCode() + ")");
            return ResponseEntity.ok(response); // Return 200 with success=false to display nicely in the editor UI
        } catch (Exception e) {
            log.error("Internal error running admin database query: {}", e.getMessage());
            response.setSuccess(false);
            response.setMessage("System Error: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    private boolean startsWithReadOnlyKeyword(String query) {
        String clean = query.trim().replaceAll("\\s+", " ").toUpperCase();
        return clean.startsWith("SELECT") || 
               clean.startsWith("SHOW") || 
               clean.startsWith("PRAGMA") || 
               clean.startsWith("EXPLAIN") || 
               clean.startsWith("WITH");
    }
}
