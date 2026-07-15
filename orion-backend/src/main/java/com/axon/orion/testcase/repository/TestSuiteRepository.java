package com.axon.orion.testcase.repository;

import com.axon.orion.testcase.entity.TestSuite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TestSuiteRepository extends JpaRepository<TestSuite, String> {
    List<TestSuite> findByAppId(String appId);
    List<TestSuite> findByEnabledTrue();
}
