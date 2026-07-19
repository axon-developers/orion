package com.axon.orion.testcase.dto;

import lombok.Data;

@Data
public class ColumnVariableInfo {
    private String columnName;
    private String placeholder; // {{columnName}}
    private String usedIn;     // "URL path", "Query param", "Request body: address.city"
    private String dataType;   // string, integer, boolean, etc.
    private boolean required;
}
