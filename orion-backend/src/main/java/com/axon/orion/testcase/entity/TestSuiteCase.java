package com.axon.orion.testcase.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import java.io.Serializable;

@Entity
@Table(name = "test_suite_cases")
@IdClass(TestSuiteCase.TestSuiteCaseId.class)
@Getter
@Setter
public class TestSuiteCase {

    @Id
    @Column(name = "suite_id", nullable = false)
    private String suiteId;

    @Id
    @Column(name = "test_case_id", nullable = false)
    private String testCaseId;

    @Column(name = "sequence_order", nullable = false)
    private int sequenceOrder;

    @Data
    public static class TestSuiteCaseId implements Serializable {
        private String suiteId;
        private String testCaseId;
    }
}
