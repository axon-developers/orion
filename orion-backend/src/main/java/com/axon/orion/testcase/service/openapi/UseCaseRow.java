package com.axon.orion.testcase.service.openapi;

import lombok.Data;
import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class UseCaseRow {
    private String usecaseName;
    private String usecaseType;        // BASE | ENUM_VARIANT | REQUIRED_ONLY | NEGATIVE
    private String expectedStatusCode; // "200", "201", "400"
    private boolean isNegativeCase;    // true -> 4XX exact assertion; false -> 2XX range assertion
    private Map<String, String> values = new LinkedHashMap<>(); // columnName -> prefilledValue
    private boolean selected = true;   // default true; user can deselect in preview
    private String notes;              // optional description shown in preview
}
