package com.axon.orion.testcase.service.openapi;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class ParsedOperation {
    private String operationId;
    private String method;         // GET, POST, PUT, DELETE, PATCH
    private String rawPath;        // /users/{id}
    private String resolvedPath;   // /users/{{id}}
    private String summary;
    private String description;
    private List<String> tags = new ArrayList<>();

    private List<ParsedParam> pathParams = new ArrayList<>();
    private List<ParsedParam> queryParams = new ArrayList<>();
    private List<ParsedParam> headerParams = new ArrayList<>();
    private List<ParsedBodyField> bodyFields = new ArrayList<>();

    private boolean hasBody;
    private String bodyContentType = "application/json"; // application/json, multipart/form-data, etc.
    private boolean isMultipart;
}
