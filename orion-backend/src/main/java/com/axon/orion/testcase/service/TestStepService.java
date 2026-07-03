package com.axon.orion.testcase.service;

import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.global_step.repository.GlobalTestStepRepository;
import com.axon.orion.testcase.dto.TestCaseDtos;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TestStepService {

    private final TestStepRepository testStepRepository;
    private final TestCaseRepository testCaseRepository;
    private final GlobalTestStepRepository globalTestStepRepository;
    private final TestCaseService testCaseService;

    public List<TestCaseDtos.TestStepDto> listSteps(String tcId) {
        validateTestCaseExists(tcId);
        return testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId)
                .stream().map(testCaseService::toStepDto).toList();
    }

    public TestCaseDtos.TestStepDto getStep(String tcId, String stepId) {
        return testCaseService.toStepDto(findStepByIdAndTcId(tcId, stepId));
    }

    @Transactional
    public TestCaseDtos.TestStepDto addStep(String tcId, TestCaseDtos.CreateTestStepRequest request) {
        validateTestCaseExists(tcId);
        List<TestStep> existing = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);

        int order = request.getSequenceOrder() != null
                ? request.getSequenceOrder()
                : existing.size() + 1;

        // Shift existing steps if inserting in the middle
        if (request.getSequenceOrder() != null) {
            existing.stream()
                    .filter(s -> s.getSequenceOrder() >= order)
                    .forEach(s -> {
                        s.setSequenceOrder(s.getSequenceOrder() + 1);
                        testStepRepository.save(s);
                    });
        }

        TestStep step = buildStep(tcId, request, order);
        return testCaseService.toStepDto(testStepRepository.save(step));
    }

    @Transactional
    public TestCaseDtos.TestStepDto updateStep(
            String tcId, String stepId, TestCaseDtos.CreateTestStepRequest request) {
        TestStep step = findStepByIdAndTcId(tcId, stepId);
        applyRequest(step, request);
        return testCaseService.toStepDto(testStepRepository.save(step));
    }

    @Transactional
    public void deleteStep(String tcId, String stepId) {
        TestStep step = findStepByIdAndTcId(tcId, stepId);
        int deletedOrder = step.getSequenceOrder();
        testStepRepository.delete(step);

        // Re-sequence remaining steps
        List<TestStep> remaining = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        int seq = 1;
        for (TestStep s : remaining) {
            if (s.getSequenceOrder() != seq) {
                s.setSequenceOrder(seq);
                testStepRepository.save(s);
            }
            seq++;
        }
    }

    @Transactional
    public List<TestCaseDtos.TestStepDto> reorderSteps(String tcId, TestCaseDtos.ReorderRequest request) {
        validateTestCaseExists(tcId);
        List<TestStep> steps = testStepRepository.findByTestCaseIdOrderBySequenceOrderAsc(tcId);
        Map<String, TestStep> stepMap = steps.stream()
                .collect(Collectors.toMap(TestStep::getId, Function.identity()));

        List<TestStep> saved = new ArrayList<>();
        int seq = 1;
        for (String stepId : request.getStepIds()) {
            TestStep step = stepMap.get(stepId);
            if (step != null) {
                step.setSequenceOrder(seq++);
                saved.add(testStepRepository.save(step));
            }
        }
        return saved.stream().map(testCaseService::toStepDto).toList();
    }

    @Transactional
    public List<TestCaseDtos.TestStepDto> bulkSaveSteps(
            String tcId, TestCaseDtos.BulkSaveRequest request) {
        validateTestCaseExists(tcId);
        testStepRepository.deleteAllByTestCaseId(tcId);

        List<TestStep> saved = new ArrayList<>();
        int seq = 1;
        for (TestCaseDtos.CreateTestStepRequest r : request.getSteps()) {
            TestStep step = buildStep(tcId, r, seq++);
            saved.add(testStepRepository.save(step));
        }
        return saved.stream().map(testCaseService::toStepDto).toList();
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private void validateTestCaseExists(String tcId) {
        if (!testCaseRepository.existsById(tcId)) {
            throw new ResourceNotFoundException("TestCase", tcId);
        }
    }

    private TestStep findStepByIdAndTcId(String tcId, String stepId) {
        TestStep step = testStepRepository.findById(stepId)
                .orElseThrow(() -> new ResourceNotFoundException("TestStep", stepId));
        if (!step.getTestCaseId().equals(tcId)) {
            throw new ResourceNotFoundException("TestStep", stepId);
        }
        return step;
    }

    private TestStep buildStep(String tcId, TestCaseDtos.CreateTestStepRequest r, int order) {
        TestStep step = new TestStep();
        step.setTestCaseId(tcId);
        step.setSequenceOrder(order);
        applyRequest(step, r);
        return step;
    }

    private void applyRequest(TestStep step, TestCaseDtos.CreateTestStepRequest r) {
        step.setName(r.getName());
        step.setDescription(r.getDescription());
        step.setStepType(r.getStepType());
        step.setActionType(r.getActionType() != null ? r.getActionType() : TestStep.ActionType.NONE);
        step.setConfig(r.getConfig() != null ? VariableInterpolator.toJson(r.getConfig()) : "{}");
        step.setExpectedResult(r.getExpectedResult());
        step.setGlobalRef(r.isGlobalRef());
        step.setGlobalStepId(r.getGlobalStepId());

        // If referencing a global step, inherit its config if not overridden
        if (r.isGlobalRef() && r.getGlobalStepId() != null && r.getConfig() == null) {
            globalTestStepRepository.findById(r.getGlobalStepId()).ifPresent(gs -> {
                step.setStepType(gs.getStepType());
                step.setActionType(gs.getActionType());
                step.setConfig(gs.getConfig());
            });
        }
    }
}
