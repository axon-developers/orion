package com.axon.orion.testcase.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "test_steps")
@Getter
@Setter
public class TestStep extends BaseEntity {

    @Column(name = "test_case_id", nullable = false)
    private String testCaseId;

    @Column(name = "sequence_order", nullable = false)
    private int sequenceOrder;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false)
    private StepType stepType;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ActionType actionType = ActionType.NONE;

    @Column(name = "config", nullable = false, columnDefinition = "TEXT")
    private String config = "{}";

    @Column(name = "expected_result", columnDefinition = "TEXT")
    private String expectedResult;

    @Column(name = "is_global_ref", nullable = false)
    private boolean isGlobalRef = false;

    @Column(name = "global_step_id")
    private String globalStepId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    public enum StepType {
        HTTP_REQUEST, ASSERTION, DELAY, SET_VARIABLE, CONDITIONAL, LOOP, SCRIPT, LOG, DATABASE_QUERY, GLOBAL_REF, PARALLEL, SOAP_REQUEST, DB_TABLE_VIEW, BROWSER_AUTOMATION
    }

    public enum ActionType {
        GET, POST, PUT, DELETE, PATCH,
        EQUALS, NOT_EQUALS, CONTAINS, GREATER_THAN, LESS_THAN, REGEX_MATCH, STATUS_CODE,
        JSON_PATH, HEADER,
        EXECUTE,
        SELECT,
        NONE
    }
}
