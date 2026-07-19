package com.axon.orion.execution.repository;

import com.axon.orion.execution.entity.SuiteExecutionCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SuiteExecutionCaseRepository extends JpaRepository<SuiteExecutionCase, String> {
    List<SuiteExecutionCase> findBySuiteExecutionId(String suiteExecutionId);
}
