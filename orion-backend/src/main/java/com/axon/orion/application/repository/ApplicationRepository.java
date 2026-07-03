package com.axon.orion.application.repository;

import com.axon.orion.application.entity.Application;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, String> {

    boolean existsByName(String name);

    Optional<Application> findByName(String name);

    @Query("SELECT a FROM Application a WHERE " +
           "(:search IS NULL OR LOWER(a.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(a.description) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:isActive IS NULL OR a.isActive = :isActive)")
    Page<Application> findAllWithSearchAndFilter(
            @Param("search") String search,
            @Param("isActive") Boolean isActive,
            Pageable pageable);
}
