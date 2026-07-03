package com.axon.orion.audit.service;

import com.axon.orion.audit.entity.AuditLog;
import com.axon.orion.audit.repository.AuditLogRepository;
import com.axon.orion.common.util.VariableInterpolator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Async
    public void log(String entityType, String entityId, String action,
                    String performedBy, Object previousValue, Object newValue) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .performedBy(performedBy)
                    .previousValue(previousValue != null ? VariableInterpolator.toJson(previousValue) : null)
                    .newValue(newValue != null ? VariableInterpolator.toJson(newValue) : null)
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.warn("Failed to log audit event for {} {}: {}", action, entityId, e.getMessage());
        }
    }

    @Async
    public void logCreate(String entityType, String entityId, String performedBy, Object newValue) {
        log(entityType, entityId, "CREATE", performedBy, null, newValue);
    }

    @Async
    public void logUpdate(String entityType, String entityId, String performedBy,
                          Object previousValue, Object newValue) {
        log(entityType, entityId, "UPDATE", performedBy, previousValue, newValue);
    }

    @Async
    public void logDelete(String entityType, String entityId, String performedBy, Object previousValue) {
        log(entityType, entityId, "DELETE", performedBy, previousValue, null);
    }
}
