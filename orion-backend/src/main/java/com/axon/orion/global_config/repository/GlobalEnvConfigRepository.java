package com.axon.orion.global_config.repository;

import com.axon.orion.global_config.entity.GlobalEnvConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GlobalEnvConfigRepository extends JpaRepository<GlobalEnvConfig, String> {
    boolean existsByConfigKey(String configKey);

    @Query("SELECT g FROM GlobalEnvConfig g WHERE " +
           "(:search IS NULL OR LOWER(g.configKey) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<GlobalEnvConfig> findAllWithSearch(@Param("search") String search, Pageable pageable);
}
