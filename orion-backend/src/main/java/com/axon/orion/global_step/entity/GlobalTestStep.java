package com.axon.orion.global_step.entity;

import com.axon.orion.common.entity.BaseEntity;
import com.axon.orion.testcase.entity.TestStep;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "global_test_steps")
@Getter
@Setter
public class GlobalTestStep extends BaseEntity {

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false)
    private TestStep.StepType stepType;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private TestStep.ActionType actionType = TestStep.ActionType.NONE;

    @Column(name = "config", nullable = false, columnDefinition = "TEXT")
    private String config = "{}";

    @Column(name = "created_by", nullable = false)
    private String createdBy;
}
