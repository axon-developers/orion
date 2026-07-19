package com.axon.orion.testcase.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "test_case_snapshots")
@Getter
@Setter
public class TestCaseSnapshot {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "test_case_id", nullable = false)
    private String testCaseId;

    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "steps_snapshot", nullable = false, columnDefinition = "TEXT")
    private String stepsSnapshot;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null || this.id.isBlank()) {
            this.id = UUID.randomUUID().toString();
        }
        this.createdAt = Instant.now();
    }
}
