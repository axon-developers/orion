package com.axon.orion.execution.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "suite_executions")
@Getter
@Setter
public class SuiteExecution {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "suite_id", nullable = false)
    private String suiteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.QUEUED;

    @Column(name = "triggered_by", nullable = false)
    private String triggeredBy;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "total_cases", nullable = false)
    private int totalCases = 0;

    @Column(name = "passed_cases", nullable = false)
    private int passedCases = 0;

    @Column(name = "failed_cases", nullable = false)
    private int failedCases = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null || this.id.isBlank()) {
            this.id = UUID.randomUUID().toString();
        }
        this.createdAt = Instant.now();
    }

    public enum Status { QUEUED, RUNNING, PASSED, FAILED, ERROR, CANCELLED }
}
