package com.axon.orion.application.service;

import com.axon.orion.application.dto.ApplicationDtos;
import com.axon.orion.application.entity.Application;
import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.audit.service.AuditService;
import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.DuplicateResourceException;
import com.axon.orion.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final AuditService auditService;

    // Counts will be injected lazily to avoid circular deps
    private final com.axon.orion.environment.repository.EnvironmentRepository environmentRepository;
    private final com.axon.orion.testcase.repository.TestCaseRepository testCaseRepository;
    private final com.axon.orion.execution.repository.ExecutionRepository executionRepository;

    public PagedResponse<ApplicationDtos.ApplicationDto> listApplications(
            int page, int size, String search, String sort, Boolean isActive) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"updatedAt", "desc"};
        Sort.Direction direction = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(direction, sortParts[0]));
        Page<Application> appPage = applicationRepository.findAllWithSearchAndFilter(search, isActive, pageRequest);
        List<ApplicationDtos.ApplicationDto> dtos = appPage.getContent().stream()
                .map(ApplicationDtos::toDto).toList();
        return PagedResponse.of(dtos, page, size, appPage.getTotalElements());
    }

    public ApplicationDtos.ApplicationDto getApplicationById(String id) {
        return ApplicationDtos.toDto(findById(id));
    }

    public ApplicationDtos.ApplicationSummaryDto getApplicationSummary(String id) {
        Application app = findById(id);
        ApplicationDtos.ApplicationSummaryDto dto = new ApplicationDtos.ApplicationSummaryDto();
        ApplicationDtos.ApplicationDto base = ApplicationDtos.toDto(app);
        dto.setId(base.getId());
        dto.setAppId(base.getAppId());
        dto.setName(base.getName());
        dto.setAppName(base.getAppName());
        dto.setPrId(base.getPrId());
        dto.setPlId(base.getPlId());
        dto.setOwner(base.getOwner());
        dto.setDescription(base.getDescription());
        dto.setActive(base.isActive());
        dto.setCreatedBy(base.getCreatedBy());
        dto.setCreatedAt(base.getCreatedAt() != null ? base.getCreatedAt().toString() : null);
        dto.setUpdatedAt(base.getUpdatedAt() != null ? base.getUpdatedAt().toString() : null);
        dto.setEnvironmentCount(environmentRepository.countByAppId(id));
        dto.setTestCaseCount(testCaseRepository.countByAppId(id));
        dto.setExecutionCount(executionRepository.countByAppId(id));
        return dto;
    }

    @Transactional
    public ApplicationDtos.ApplicationDto createApplication(
            ApplicationDtos.CreateApplicationRequest request, String userId) {
        request.sanitize();
        String resolvedName = request.getResolvedName();
        if (applicationRepository.existsByName(resolvedName)) {
            throw new DuplicateResourceException("Application", "name", resolvedName);
        }
        if (applicationRepository.existsById(request.getAppId())) {
            throw new DuplicateResourceException("Application", "appId", request.getAppId());
        }

        Application app = new Application();
        app.setId(request.getAppId());
        app.setName(resolvedName);
        app.setPrId(request.getPrId());
        app.setPlId(request.getPlId());
        app.setOwner(request.getOwner());
        app.setDescription(request.getDescription());
        app.setCreatedBy(userId);

        Application saved = applicationRepository.save(app);
        auditService.logCreate("Application", saved.getId(), userId, ApplicationDtos.toDto(saved));
        return ApplicationDtos.toDto(saved);
    }

    @Transactional
    public ApplicationDtos.ApplicationDto updateApplication(
            String id, ApplicationDtos.UpdateApplicationRequest request, String userId) {
        request.sanitize();
        Application app = findById(id);
        ApplicationDtos.ApplicationDto previous = ApplicationDtos.toDto(app);

        String resolvedName = request.getResolvedName();
        if (resolvedName != null && !app.getName().equals(resolvedName) && applicationRepository.existsByName(resolvedName)) {
            throw new DuplicateResourceException("Application", "name", resolvedName);
        }
        
        if (resolvedName != null) app.setName(resolvedName);
        if (request.getPrId() != null) app.setPrId(request.getPrId());
        if (request.getPlId() != null) app.setPlId(request.getPlId());
        if (request.getOwner() != null) app.setOwner(request.getOwner());
        if (request.getDescription() != null) app.setDescription(request.getDescription());
        if (request.getIsActive() != null) app.setActive(request.getIsActive());

        Application saved = applicationRepository.save(app);
        auditService.logUpdate("Application", id, userId, previous, ApplicationDtos.toDto(saved));
        return ApplicationDtos.toDto(saved);
    }

    @Transactional
    public void deleteApplication(String id, String userId) {
        Application app = findById(id);
        ApplicationDtos.ApplicationDto previous = ApplicationDtos.toDto(app);
        app.setActive(false);
        applicationRepository.save(app);
        auditService.logDelete("Application", id, userId, previous);
    }

    private Application findById(String id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
    }
}
