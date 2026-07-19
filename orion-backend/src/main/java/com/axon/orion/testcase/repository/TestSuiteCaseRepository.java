package com.axon.orion.testcase.repository;

import com.axon.orion.testcase.entity.TestSuiteCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TestSuiteCaseRepository extends JpaRepository<TestSuiteCase, TestSuiteCase.TestSuiteCaseId> {
    List<TestSuiteCase> findBySuiteIdOrderBySequenceOrderAsc(String suiteId);
    void deleteBySuiteId(String suiteId);
}
