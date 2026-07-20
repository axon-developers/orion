package com.axon.orion.testcase.service.openapi;

import com.axon.orion.testcase.dto.OperationPreview;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class ApiChainDetector {

    @Data
    public static class ChainedGroup {
        private String resourceName;
        private OperationPreview createOp;
        private OperationPreview getOp;
        private OperationPreview updateOp;
        private OperationPreview deleteOp;
        private List<OperationPreview> otherOps = new ArrayList<>();
        private String extractedIdVariable;
    }

    public List<ChainedGroup> detectChains(List<OperationPreview> operations) {
        if (operations == null || operations.isEmpty()) {
            return Collections.emptyList();
        }

        // Group operations by normalized base path (e.g. /api/users/{id} -> /api/users)
        Map<String, List<OperationPreview>> resourceGroups = new LinkedHashMap<>();

        for (OperationPreview op : operations) {
            String basePath = normalizePath(op.getPath());
            resourceGroups.computeIfAbsent(basePath, k -> new ArrayList<>()).add(op);
        }

        List<ChainedGroup> chains = new ArrayList<>();

        for (Map.Entry<String, List<OperationPreview>> entry : resourceGroups.entrySet()) {
            String basePath = entry.getKey();
            List<OperationPreview> ops = entry.getValue();

            ChainedGroup group = new ChainedGroup();
            String resourceName = extractResourceName(basePath);
            group.setResourceName(resourceName);
            group.setExtractedIdVariable("created_" + resourceName + "_id");

            for (OperationPreview op : ops) {
                String method = op.getMethod().toUpperCase();
                boolean isItemPath = op.getPath().contains("{") || op.getPath().contains("}}");

                if ("POST".equals(method) && !isItemPath && group.getCreateOp() == null) {
                    group.setCreateOp(op);
                } else if ("GET".equals(method) && isItemPath && group.getGetOp() == null) {
                    group.setGetOp(op);
                } else if (("PUT".equals(method) || "PATCH".equals(method)) && isItemPath && group.getUpdateOp() == null) {
                    group.setUpdateOp(op);
                } else if ("DELETE".equals(method) && isItemPath && group.getDeleteOp() == null) {
                    group.setDeleteOp(op);
                } else {
                    group.getOtherOps().add(op);
                }
            }

            // A valid chain requires at least a Create (POST) and at least one dependent item operation
            if (group.getCreateOp() != null && (group.getGetOp() != null || group.getUpdateOp() != null || group.getDeleteOp() != null)) {
                chains.add(group);
            }
        }

        return chains;
    }

    private String normalizePath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) return "/";
        // Remove trailing parameters like /{id} or /{{id}}
        String cleaned = rawPath.replaceAll("/\\{([^}]+)\\}", "").replaceAll("/\\{\\{([^}]+)\\}\\}", "");
        return cleaned.isEmpty() ? "/" : cleaned;
    }

    private String extractResourceName(String basePath) {
        String[] segments = basePath.split("/");
        for (int i = segments.length - 1; i >= 0; i--) {
            String seg = segments[i].trim();
            if (!seg.isEmpty() && !seg.startsWith("api") && !seg.startsWith("v1") && !seg.startsWith("v2")) {
                return seg.replaceAll("[^a-zA-Z0-9]", "");
            }
        }
        return "resource";
    }
}
