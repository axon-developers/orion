package com.axon.orion.testcase.service.openapi;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class ParsedBodyField {
    private String name;
    private String type = "string";
    private boolean required;
    private List<String> enumValues = new ArrayList<>();
    private String format;
    private Object exampleValue;
    private Object defaultValue;
    private Double minimum;
    private Double maximum;
    private Boolean exclusiveMinimum;
    private Boolean exclusiveMaximum;
    private Integer minLength;
    private Integer maxLength;
    private String pattern;
    private List<ParsedBodyField> nestedFields = new ArrayList<>();
}
