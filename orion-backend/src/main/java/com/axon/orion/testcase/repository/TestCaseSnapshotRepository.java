package com.axon.orion.testcase.repository;

import com.axon.orion.testcase.entity.TestCaseSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TestCaseSnapshotRepository extends JpaRepository<TestCaseSnapshot, String> {
    List<TestCaseSnapshot> findByTestCaseIdOrderByVersionDesc(String testCaseId);
    Optional<TestCaseSnapshot> findByTestCaseIdAndVersion(String testCaseId, int version);
}
