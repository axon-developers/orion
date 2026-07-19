package com.axon.orion.execution.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.UUID;

@Entity
@Table(name = "suite_execution_cases")
@Getter
@Setter
public class SuiteExecutionCase {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "suite_execution_id", nullable = false)
    private String suiteExecutionId;

    @Column(name = "test_case_id", nullable = false)
    private String testCaseId;

    @Column(name = "execution_id")
    private String executionId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "duration_ms")
    private Long durationMs;

    @PrePersist
    protected void onCreate() {
        if (this.id == null || this.id.isBlank()) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
