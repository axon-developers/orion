package com.axon.orion.testcase.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "test_suites")
@Getter
@Setter
public class TestSuite extends BaseEntity {

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "cron_expression")
    private String cronExpression;

    @Column(name = "environment_id")
    private String environmentId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "stop_on_failure", nullable = false)
    private boolean stopOnFailure = false;

    @Column(name = "parallelism", nullable = false)
    private int parallelism = 1;

    @Column(name = "created_by", nullable = false)
    private String createdBy;
}
