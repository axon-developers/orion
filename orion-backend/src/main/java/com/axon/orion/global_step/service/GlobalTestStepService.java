package com.axon.orion.global_step.service;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.global_step.dto.GlobalTestStepDtos;
import com.axon.orion.global_step.entity.GlobalTestStep;
import com.axon.orion.global_step.repository.GlobalTestStepRepository;
import com.axon.orion.testcase.entity.TestStep;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GlobalTestStepService {

    private final GlobalTestStepRepository repository;
    private final com.axon.orion.testcase.repository.TestStepRepository testStepRepository;

    public PagedResponse<GlobalTestStepDtos.GlobalTestStepDto> listSteps(
            int page, int size, String search, TestStep.StepType stepType) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("name").ascending());
        Page<GlobalTestStep> result = repository.findAllWithFilters(search, stepType, pageRequest);
        List<GlobalTestStepDtos.GlobalTestStepDto> dtos = result.getContent().stream()
                .map(GlobalTestStepDtos::toDto).toList();
        return PagedResponse.of(dtos, page, size, result.getTotalElements());
    }

    public GlobalTestStepDtos.GlobalTestStepDto getStep(String id) {
        return GlobalTestStepDtos.toDto(findById(id));
    }

    @Transactional
    public GlobalTestStepDtos.GlobalTestStepDto createStep(
            GlobalTestStepDtos.CreateGlobalTestStepRequest request, String userId) {
        GlobalTestStep step = new GlobalTestStep();
        step.setName(request.getName());
        step.setDescription(request.getDescription());
        step.setStepType(request.getStepType());
        step.setActionType(request.getActionType() != null ? request.getActionType() : TestStep.ActionType.NONE);
        step.setConfig(request.getConfig() != null ? VariableInterpolator.toJson(request.getConfig()) : "{}");
        step.setCreatedBy(userId);
        return GlobalTestStepDtos.toDto(repository.save(step));
    }

    @Transactional
    public GlobalTestStepDtos.GlobalTestStepDto updateStep(
            String id, GlobalTestStepDtos.CreateGlobalTestStepRequest request) {
        GlobalTestStep step = findById(id);
        step.setName(request.getName());
        step.setDescription(request.getDescription());
        step.setStepType(request.getStepType());
        if (request.getActionType() != null) step.setActionType(request.getActionType());
        if (request.getConfig() != null) step.setConfig(VariableInterpolator.toJson(request.getConfig()));
        return GlobalTestStepDtos.toDto(repository.save(step));
    }

    @Transactional
    public void deleteStep(String id) {
        GlobalTestStep step = findById(id);
        repository.delete(step);
    }

    @Transactional
    public GlobalTestStepDtos.GlobalTestStepDto promoteStep(String testStepId, String userId) {
        TestStep ts = testStepRepository.findById(testStepId)
                .orElseThrow(() -> new ResourceNotFoundException("TestStep", testStepId));

        GlobalTestStep step = new GlobalTestStep();
        step.setName(ts.getName() + " (Global)");
        step.setDescription(ts.getDescription());
        step.setStepType(ts.getStepType());
        step.setActionType(ts.getActionType() != null ? ts.getActionType() : TestStep.ActionType.NONE);
        step.setConfig(ts.getConfig() != null ? ts.getConfig() : "{}");
        step.setCreatedBy(userId);

        GlobalTestStep saved = repository.save(step);

        ts.setGlobalRef(true);
        ts.setGlobalStepId(saved.getId());
        testStepRepository.save(ts);

        return GlobalTestStepDtos.toDto(saved);
    }

    private GlobalTestStep findById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GlobalTestStep", id));
    }
}
