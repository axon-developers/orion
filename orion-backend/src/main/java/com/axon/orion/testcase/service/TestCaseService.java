package com.axon.orion.testcase.service;

import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.audit.service.AuditService;
import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.testcase.dto.TestCaseDtos;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final TestStepRepository testStepRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public PagedResponse<TestCaseDtos.TestCaseDto> listTestCases(
            String appId, int page, int size, String search,
            TestCase.Status status, TestCase.Priority priority, String sort) {
        validateAppExists(appId);
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"updatedAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<TestCase> tcPage = testCaseRepository.findByAppIdWithFilters(appId, search, status, priority, pageRequest);
        List<TestCaseDtos.TestCaseDto> dtos = tcPage.getContent().stream()
                .map(tc -> toDto(tc, false)).toList();
        return PagedResponse.of(dtos, page, size, tcPage.getTotalElements());
    }

    public TestCaseDtos.TestCaseDetailDto getTestCaseWithSteps(String appId, String tcId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        TestCaseDtos.TestCaseDetailDto dto = new TestCaseDtos.TestCaseDetailDto();
        copyToDto(tc, dto);
        dto.setSteps(testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId)
                .stream().map(this::toStepDto).toList());
        return dto;
    }

    @Transactional
    public TestCaseDtos.TestCaseDto createTestCase(
            String appId, TestCaseDtos.CreateTestCaseRequest request, String userId) {
        validateAppExists(appId);
        TestCase tc = new TestCase();
        tc.setAppId(appId);
        tc.setName(request.getName());
        tc.setDescription(request.getDescription());
        tc.setTags(VariableInterpolator.toJson(request.getTags() != null ? request.getTags() : List.of()));
        tc.setPriority(request.getPriority() != null ? request.getPriority() : TestCase.Priority.MEDIUM);
        tc.setStatus(request.getStatus() != null ? request.getStatus() : TestCase.Status.DRAFT);
        tc.setCreatedBy(userId);
        TestCase saved = testCaseRepository.save(tc);
        auditService.logCreate("TestCase", saved.getId(), userId, toDto(saved, false));
        return toDto(saved, false);
    }

    @Transactional
    public TestCaseDtos.TestCaseDto updateTestCase(
            String appId, String tcId, TestCaseDtos.UpdateTestCaseRequest request, String userId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        if (request.getName() != null) tc.setName(request.getName());
        if (request.getDescription() != null) tc.setDescription(request.getDescription());
        if (request.getTags() != null) tc.setTags(VariableInterpolator.toJson(request.getTags()));
        if (request.getPriority() != null) tc.setPriority(request.getPriority());
        if (request.getStatus() != null) tc.setStatus(request.getStatus());
        return toDto(testCaseRepository.save(tc), false);
    }

    @Transactional
    public void deleteTestCase(String appId, String tcId, String userId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        testStepRepository.deleteAllByTestCaseId(tcId);
        testCaseRepository.delete(tc);
        auditService.logDelete("TestCase", tcId, userId, toDto(tc, false));
    }

    @Transactional
    public TestCaseDtos.TestCaseDto cloneTestCase(String appId, String tcId, String userId) {
        TestCase source = findByIdAndAppId(appId, tcId);
        TestCase clone = new TestCase();
        clone.setAppId(appId);
        clone.setName(source.getName() + " (copy)");
        clone.setDescription(source.getDescription());
        clone.setTags(source.getTags());
        clone.setPriority(source.getPriority());
        clone.setStatus(TestCase.Status.DRAFT);
        clone.setCreatedBy(userId);
        TestCase savedClone = testCaseRepository.save(clone);

        // Clone all steps
        List<TestStep> sourceSteps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        for (TestStep s : sourceSteps) {
            TestStep cloneStep = new TestStep();
            cloneStep.setTestCaseId(savedClone.getId());
            cloneStep.setSequenceOrder(s.getSequenceOrder());
            cloneStep.setName(s.getName());
            cloneStep.setDescription(s.getDescription());
            cloneStep.setStepType(s.getStepType());
            cloneStep.setActionType(s.getActionType());
            cloneStep.setConfig(s.getConfig());
            cloneStep.setExpectedResult(s.getExpectedResult());
            cloneStep.setGlobalRef(s.isGlobalRef());
            cloneStep.setGlobalStepId(s.getGlobalStepId());
            testStepRepository.save(cloneStep);
        }
        return toDto(savedClone, false);
    }

    public String exportTestCase(String appId, String tcId) {
        TestCase tc = findByIdAndAppId(appId, tcId);
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        var export = new java.util.HashMap<String, Object>();
        export.put("testCase", toDto(tc, false));
        export.put("steps", steps.stream().map(this::toStepDto).toList());
        return VariableInterpolator.toJson(export);
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private void validateAppExists(String appId) {
        if (!applicationRepository.existsById(appId)) {
            throw new ResourceNotFoundException("Application", appId);
        }
    }

    private TestCase findByIdAndAppId(String appId, String tcId) {
        TestCase tc = testCaseRepository.findById(tcId)
                .orElseThrow(() -> new ResourceNotFoundException("TestCase", tcId));
        if (!tc.getAppId().equals(appId)) {
            throw new ResourceNotFoundException("TestCase", tcId);
        }
        return tc;
    }

    TestCaseDtos.TestCaseDto toDto(TestCase tc, boolean withStepCount) {
        TestCaseDtos.TestCaseDto dto = new TestCaseDtos.TestCaseDto();
        copyToDto(tc, dto);
        if (withStepCount) {
            dto.setStepCount(testStepRepository.countByTestCaseId(tc.getId()));
        }
        return dto;
    }

    private void copyToDto(TestCase tc, TestCaseDtos.TestCaseDto dto) {
        dto.setId(tc.getId());
        dto.setAppId(tc.getAppId());
        dto.setName(tc.getName());
        dto.setDescription(tc.getDescription());
        dto.setPriority(tc.getPriority().name());
        dto.setStatus(tc.getStatus().name());
        dto.setCreatedBy(tc.getCreatedBy());
        dto.setCreatedAt(tc.getCreatedAt());
        dto.setUpdatedAt(tc.getUpdatedAt());
        try {
            dto.setTags(objectMapper.readValue(
                    tc.getTags() != null ? tc.getTags() : "[]",
                    new TypeReference<>() {}));
        } catch (Exception e) {
            dto.setTags(List.of());
        }
    }

    TestCaseDtos.TestStepDto toStepDto(TestStep step) {
        TestCaseDtos.TestStepDto dto = new TestCaseDtos.TestStepDto();
        dto.setId(step.getId());
        dto.setTestCaseId(step.getTestCaseId());
        dto.setSequenceOrder(step.getSequenceOrder());
        dto.setName(step.getName());
        dto.setDescription(step.getDescription());
        dto.setStepType(step.getStepType().name());
        dto.setActionType(step.getActionType().name());
        dto.setExpectedResult(step.getExpectedResult());
        dto.setGlobalRef(step.isGlobalRef());
        dto.setGlobalStepId(step.getGlobalStepId());
        dto.setCreatedAt(step.getCreatedAt());
        dto.setUpdatedAt(step.getUpdatedAt());
        try {
            dto.setConfig(objectMapper.readValue(
                    step.getConfig() != null ? step.getConfig() : "{}",
                    Object.class));
        } catch (Exception e) {
            dto.setConfig(new java.util.HashMap<>());
        }
        return dto;
    }
}
