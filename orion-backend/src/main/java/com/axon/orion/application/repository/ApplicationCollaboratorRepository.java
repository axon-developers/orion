package com.axon.orion.application.repository;

import com.axon.orion.application.entity.ApplicationCollaborator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicationCollaboratorRepository extends JpaRepository<ApplicationCollaborator, String> {
    List<ApplicationCollaborator> findByApplicationId(String applicationId);
    Optional<ApplicationCollaborator> findByApplicationIdAndUsername(String applicationId, String username);
    void deleteByApplicationIdAndUsername(String applicationId, String username);
    boolean existsByApplicationIdAndUsername(String applicationId, String username);
}
