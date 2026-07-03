package com.axon.orion.testcase.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "test_cases")
@Getter
@Setter
public class TestCase extends BaseEntity {

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tags = "[]";

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private Priority priority = Priority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.DRAFT;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    public enum Priority { LOW, MEDIUM, HIGH, CRITICAL }
    public enum Status { DRAFT, READY, DEPRECATED }
}
