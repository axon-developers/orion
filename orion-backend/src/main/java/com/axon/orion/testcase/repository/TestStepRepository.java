package com.axon.orion.testcase.repository;

import com.axon.orion.testcase.entity.TestStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestStepRepository extends JpaRepository<TestStep, String> {
    List<TestStep> findByTestCaseIdOrderBySequenceOrderAsc(String testCaseId);
    long countByTestCaseId(String testCaseId);

    @Modifying
    @Query("DELETE FROM TestStep ts WHERE ts.testCaseId = :testCaseId")
    void deleteAllByTestCaseId(@Param("testCaseId") String testCaseId);
}
