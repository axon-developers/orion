package com.axon.orion.execution.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "executions")
@Getter
@Setter
public class Execution extends BaseEntity {

    @Column(name = "test_case_id", nullable = false)
    private String testCaseId;

    @Column(name = "environment_id", nullable = false)
    private String environmentId;

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

    @Column(name = "total_steps", nullable = false)
    private int totalSteps = 0;

    @Column(name = "passed_steps", nullable = false)
    private int passedSteps = 0;

    @Column(name = "failed_steps", nullable = false)
    private int failedSteps = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "step_ids", columnDefinition = "TEXT")
    private String stepIds;

    public enum Status { QUEUED, RUNNING, PASSED, FAILED, ERROR, CANCELLED }
}
