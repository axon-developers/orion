package com.axon.orion.testcase.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class AdvancedGeneratorOptions {
    private String groupBy = "TAG"; // "TAG" (default) | "OPERATION" | "SINGLE"
    private boolean includeNegativeCases = true;
    private boolean includeOptionalFields = true;
    private int maxUseCasesPerOperation = 20; // default 20, max 50
    private String authHeaderVariable = "authToken"; // default "authToken", always injected
    private boolean strictStatusCode = false; // false = assert 2XX range; true = assert exact status code
    private boolean includeBoundaryCases = true; // boundary value testing (min/max bounds)
    private boolean useDynamicMockData = false; // insert dynamic functions like {{$randomEmail}}
    private boolean enableCrudChaining = false; // auto-chain CRUD endpoints into multi-step workflows
    private List<String> operationFilter = new ArrayList<>(); // operationIds or paths to include (empty = all)
}
