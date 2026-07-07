package com.axon.orion.execution.repository;

import com.axon.orion.execution.entity.ExecutionStepLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionStepLogRepository extends JpaRepository<ExecutionStepLog, String> {
    List<ExecutionStepLog> findByExecutionIdOrderBySequenceOrderAsc(String executionId);
    Optional<ExecutionStepLog> findByExecutionIdAndSequenceOrder(String executionId, int sequenceOrder);
}
