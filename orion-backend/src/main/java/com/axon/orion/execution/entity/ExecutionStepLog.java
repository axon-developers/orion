package com.axon.orion.execution.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "execution_step_logs")
@Getter
@Setter
public class ExecutionStepLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "execution_id", nullable = false)
    private String executionId;

    @Column(name = "test_step_id", nullable = false)
    private String testStepId;

    @Column(name = "sequence_order", nullable = false)
    private int sequenceOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "input_payload", columnDefinition = "TEXT")
    private String inputPayload = "{}";

    @Column(name = "output_payload", columnDefinition = "TEXT")
    private String outputPayload = "{}";

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at")
    private String startedAt;

    @Column(name = "completed_at")
    private String completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }

    public enum Status { PENDING, RUNNING, PASSED, FAILED, SKIPPED }
}
