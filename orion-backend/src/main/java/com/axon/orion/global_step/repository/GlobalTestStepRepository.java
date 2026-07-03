package com.axon.orion.global_step.repository;

import com.axon.orion.global_step.entity.GlobalTestStep;
import com.axon.orion.testcase.entity.TestStep;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GlobalTestStepRepository extends JpaRepository<GlobalTestStep, String> {

    @Query("SELECT g FROM GlobalTestStep g WHERE " +
           "(:search IS NULL OR LOWER(g.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:stepType IS NULL OR g.stepType = :stepType)")
    Page<GlobalTestStep> findAllWithFilters(
            @Param("search") String search,
            @Param("stepType") TestStep.StepType stepType,
            Pageable pageable);
}
