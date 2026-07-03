package com.axon.orion.execution.repository;

import com.axon.orion.execution.entity.ExecutionStepLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionStepLogRepository extends JpaRepository<ExecutionStepLog, String> {
    List<ExecutionStepLog> findByExecutionIdOrderBySequenceOrderAsc(String executionId);
}
