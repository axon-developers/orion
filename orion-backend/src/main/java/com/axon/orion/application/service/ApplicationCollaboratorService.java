package com.axon.orion.application.service;

import com.axon.orion.application.entity.ApplicationCollaborator;
import com.axon.orion.application.repository.ApplicationCollaboratorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ApplicationCollaboratorService {

    private final ApplicationCollaboratorRepository applicationCollaboratorRepository;

    public List<ApplicationCollaborator> listCollaborators(String appId) {
        return applicationCollaboratorRepository.findByApplicationId(appId);
    }

    @Transactional
    public ApplicationCollaborator addCollaborator(String appId, String username) {
        if (applicationCollaboratorRepository.existsByApplicationIdAndUsername(appId, username)) {
            throw new IllegalArgumentException("User is already a collaborator");
        }
        ApplicationCollaborator collaborator = new ApplicationCollaborator();
        collaborator.setApplicationId(appId);
        collaborator.setUsername(username);
        collaborator.setRole("EDITOR");
        return applicationCollaboratorRepository.save(collaborator);
    }

    @Transactional
    public void removeCollaborator(String appId, String username) {
        applicationCollaboratorRepository.deleteByApplicationIdAndUsername(appId, username);
    }
}
