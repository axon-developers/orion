package com.axon.orion.execution.engine;

import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.entity.TestStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.sql.*;
import java.util.*;

@Slf4j
@Component
public class DatabaseQueryExecutor {

    public StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context) {
        String connectionString = VariableInterpolator.resolve((String) config.get("connectionString"), context);
        String query = VariableInterpolator.resolve((String) config.get("query"), context);
        String resultVariable = (String) config.get("resultVariable");

        if (connectionString == null || connectionString.isBlank()) {
            return StepResult.failed("connectionString is required for DATABASE_QUERY step", Map.of());
        }
        if (query == null || query.isBlank()) {
            return StepResult.failed("query is required for DATABASE_QUERY step", Map.of());
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("query", query);

        try (Connection conn = DriverManager.getConnection(connectionString);
             Statement stmt = conn.createStatement()) {
            
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
        } catch (Exception e) {
            log.error("Database query failed: {}", e.getMessage(), e);
            return StepResult.failed("Database query failed: " + e.getMessage(), output);
        }
    }
}
