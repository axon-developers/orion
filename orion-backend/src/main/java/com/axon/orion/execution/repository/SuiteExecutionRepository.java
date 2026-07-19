package com.axon.orion.execution.repository;

import com.axon.orion.execution.entity.SuiteExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SuiteExecutionRepository extends JpaRepository<SuiteExecution, String> {
    List<SuiteExecution> findBySuiteIdOrderByCreatedAtDesc(String suiteId);
}
