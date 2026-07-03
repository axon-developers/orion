package com.axon.orion.testcase.repository;

import com.axon.orion.testcase.entity.TestCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, String> {

    long countByAppId(String appId);

    @Query("SELECT tc FROM TestCase tc WHERE tc.appId = :appId AND " +
           "(:search IS NULL OR LOWER(tc.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR tc.status = :status) AND " +
           "(:priority IS NULL OR tc.priority = :priority)")
    Page<TestCase> findByAppIdWithFilters(
            @Param("appId") String appId,
            @Param("search") String search,
            @Param("status") TestCase.Status status,
            @Param("priority") TestCase.Priority priority,
            Pageable pageable);
}
