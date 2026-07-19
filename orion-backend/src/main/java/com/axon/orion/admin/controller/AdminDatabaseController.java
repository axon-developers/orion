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
        private Long executionTimeMs;
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
        private boolean primaryKey;
    }

    @Data
    public static class TableMetaDto {
        private String tableName;
        private long rowCount;
    }

    /**
     * Lists all tables in the Orion internal database with their row counts.
     */
    @GetMapping("/tables")
    public ResponseEntity<List<TableMetaDto>> listTables() {
        List<TableMetaDto> tables = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            String[] types = {"TABLE"};
            List<String> tableNames = new ArrayList<>();
            try (ResultSet rs = metaData.getTables(null, null, "%", types)) {
                while (rs.next()) {
                    tableNames.add(rs.getString("TABLE_NAME"));
                }
            }
            
            for (String tableName : tableNames) {
                long count = 0;
                try (Statement stmt = conn.createStatement();
                     ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + tableName)) {
                    if (rs.next()) {
                        count = rs.getLong(1);
                    }
                } catch (Exception e) {
                    log.warn("Failed to get row count for table {}: {}", tableName, e.getMessage());
                }
                TableMetaDto dto = new TableMetaDto();
                dto.setTableName(tableName);
                dto.setRowCount(count);
                tables.add(dto);
            }
            
            tables.sort(Comparator.comparing(TableMetaDto::getTableName));
            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            log.error("Failed to list database tables: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieves column details, types, and primary key status for a specific table.
     */
    @GetMapping("/tables/{tableName}/schema")
    public ResponseEntity<TableSchemaResponse> getTableSchema(@PathVariable String tableName) {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
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

            Set<String> primaryKeys = new HashSet<>();
            try (ResultSet rs = metaData.getPrimaryKeys(null, null, exactTableName)) {
                while (rs.next()) {
                    primaryKeys.add(rs.getString("COLUMN_NAME"));
                }
            }

            List<ColumnMeta> columns = new ArrayList<>();
            try (ResultSet rs = metaData.getColumns(null, null, exactTableName, "%")) {
                while (rs.next()) {
                    ColumnMeta col = new ColumnMeta();
                    String colName = rs.getString("COLUMN_NAME");
                    col.setColumnName(colName);
                    col.setDataType(rs.getString("TYPE_NAME"));
                    col.setColumnSize(rs.getInt("COLUMN_SIZE"));
                    col.setNullable("YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")));
                    col.setPrimaryKey(primaryKeys.contains(colName));
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

        long startTime = System.currentTimeMillis();
        try (Connection conn = dataSource.getConnection()) {
            boolean isSelectOrShow = startsWithReadOnlyKeyword(rawQuery);

            try (Statement stmt = conn.createStatement()) {
                if (isSelectOrShow) {
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

                        long duration = System.currentTimeMillis() - startTime;
                        response.setSuccess(true);
                        response.setColumns(columns);
                        response.setRows(rows);
                        response.setRowCount(rows.size());
                        response.setExecutionTimeMs(duration);
                        response.setMessage("Query executed successfully. Returned " + rows.size() + " rows in " + duration + " ms.");
                    }
                } else {
                    int affected = stmt.executeUpdate(rawQuery);
                    long duration = System.currentTimeMillis() - startTime;
                    response.setSuccess(true);
                    response.setAffectedRows(affected);
                    response.setExecutionTimeMs(duration);
                    response.setMessage("Update executed successfully. Affected rows: " + affected + " in " + duration + " ms.");
                }
            }
            return ResponseEntity.ok(response);
        } catch (SQLException e) {
            log.warn("SQL Exception executed by admin: {}", e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            response.setSuccess(false);
            response.setExecutionTimeMs(duration);
            response.setMessage("SQL Database Error: " + e.getMessage() + " (State: " + e.getSQLState() + ", Code: " + e.getErrorCode() + ")");
            return ResponseEntity.ok(response);
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
