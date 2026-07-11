package com.axon.orion.application.service;

import com.axon.orion.application.repository.ApplicationCollaboratorRepository;
import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service("applicationAccessService")
@RequiredArgsConstructor
public class ApplicationAccessService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationCollaboratorRepository applicationCollaboratorRepository;
    private final TestCaseRepository testCaseRepository;
    private final ExecutionRepository executionRepository;

    public boolean canEdit(String appId, User user) {
        if (user == null) {
            return false;
        }
        if (user.getRole() == User.Role.ADMIN) {
            return true;
        }
        return applicationRepository.findById(appId)
                .map(app -> app.getCreatedBy().equals(user.getId()) ||
                        applicationCollaboratorRepository.existsByApplicationIdAndUsername(appId, user.getUsername()))
                .orElse(false);
    }

    public boolean canEditTestCase(String tcId, User user) {
        if (user == null) {
            return false;
        }
        if (user.getRole() == User.Role.ADMIN) {
            return true;
        }
        return testCaseRepository.findById(tcId)
                .map(tc -> canEdit(tc.getAppId(), user))
                .orElse(false);
    }

    public boolean canEditExecution(String execId, User user) {
        if (user == null) {
            return false;
        }
        if (user.getRole() == User.Role.ADMIN) {
            return true;
        }
        return executionRepository.findById(execId)
                .map(exec -> canEditTestCase(exec.getTestCaseId(), user))
                .orElse(false);
    }
}
