package com.axon.orion.environment.repository;

import com.axon.orion.environment.entity.Environment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnvironmentRepository extends JpaRepository<Environment, String> {
    List<Environment> findByAppIdOrderByCreatedAtAsc(String appId);
    Optional<Environment> findByAppIdAndName(String appId, String name);
    boolean existsByAppIdAndName(String appId, String name);
    long countByAppId(String appId);
}
