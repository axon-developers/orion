package com.axon.orion.audit.repository;

import com.axon.orion.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    Page<AuditLog> findByEntityTypeAndEntityId(String entityType, String entityId, Pageable pageable);
    Page<AuditLog> findByPerformedBy(String performedBy, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:entityType IS NULL OR a.entityType = :entityType) AND " +
           "(:performedBy IS NULL OR a.performedBy = :performedBy) ORDER BY a.timestamp DESC")
    Page<AuditLog> findAllWithFilters(
            @Param("entityType") String entityType,
            @Param("performedBy") String performedBy,
            Pageable pageable);
}
