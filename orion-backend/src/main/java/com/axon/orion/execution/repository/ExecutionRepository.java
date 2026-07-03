package com.axon.orion.execution.repository;

import com.axon.orion.execution.entity.Execution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ExecutionRepository extends JpaRepository<Execution, String> {

    Page<Execution> findByTestCaseId(String testCaseId, Pageable pageable);

    @Query("SELECT COUNT(e) FROM Execution e JOIN TestCase tc ON e.testCaseId = tc.id WHERE tc.appId = :appId")
    long countByAppId(@Param("appId") String appId);

    @Query("SELECT e FROM Execution e WHERE " +
           "(:testCaseId IS NULL OR e.testCaseId = :testCaseId) AND " +
           "(:environmentId IS NULL OR e.environmentId = :environmentId) AND " +
           "(:status IS NULL OR e.status = :status)")
    Page<Execution> findAllWithFilters(
            @Param("testCaseId") String testCaseId,
            @Param("environmentId") String environmentId,
            @Param("status") Execution.Status status,
            Pageable pageable);

    @Query("SELECT e FROM Execution e JOIN TestCase tc ON e.testCaseId = tc.id " +
           "WHERE tc.appId = :appId")
    Page<Execution> findByAppId(@Param("appId") String appId, Pageable pageable);
}
