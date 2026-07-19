package com.axon.orion.testcase.service;

import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.SuiteExecution;
import com.axon.orion.execution.entity.SuiteExecutionCase;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.SuiteExecutionCaseRepository;
import com.axon.orion.execution.repository.SuiteExecutionRepository;
import com.axon.orion.execution.service.ExecutionService;
import com.axon.orion.testcase.dto.TestSuiteDtos;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.entity.TestSuite;
import com.axon.orion.testcase.entity.TestSuiteCase;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestSuiteCaseRepository;
import com.axon.orion.testcase.repository.TestSuiteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestSuiteService {

    private final TestSuiteRepository testSuiteRepository;
    private final TestSuiteCaseRepository testSuiteCaseRepository;
    private final TestCaseRepository testCaseRepository;
    private final SuiteExecutionRepository suiteExecutionRepository;
    private final SuiteExecutionCaseRepository suiteExecutionCaseRepository;
    private final ExecutionService executionService;
    private final ExecutionRepository executionRepository;
    
    @Lazy
    private final TestSuiteSchedulerService schedulerService;

    @Transactional
    public TestSuiteDtos.TestSuiteDto createSuite(String appId, TestSuiteDtos.CreateTestSuiteRequest request, String userId) {
        TestSuite suite = new TestSuite();
        suite.setAppId(appId);
        suite.setName(request.getName());
        suite.setDescription(request.getDescription());
        suite.setCronExpression(request.getCronExpression());
        suite.setEnvironmentId(request.getEnvironmentId());
        suite.setEnabled(request.isEnabled());
        suite.setStopOnFailure(request.isStopOnFailure());
        suite.setParallelism(request.getParallelism() > 0 ? request.getParallelism() : 1);
        suite.setCreatedBy(userId);

        TestSuite saved = testSuiteRepository.save(suite);

        if (request.getTestCaseIds() != null) {
            int seq = 1;
            for (String tcId : request.getTestCaseIds()) {
                TestSuiteCase tsc = new TestSuiteCase();
                tsc.setSuiteId(saved.getId());
                tsc.setTestCaseId(tcId);
                tsc.setSequenceOrder(seq++);
                testSuiteCaseRepository.save(tsc);
            }
        }

        schedulerService.scheduleSuite(saved);
        return toDto(saved);
    }

    @Transactional
    public TestSuiteDtos.TestSuiteDto updateSuite(String id, TestSuiteDtos.CreateTestSuiteRequest request) {
        TestSuite suite = testSuiteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestSuite", id));

        suite.setName(request.getName());
        suite.setDescription(request.getDescription());
        suite.setCronExpression(request.getCronExpression());
        suite.setEnvironmentId(request.getEnvironmentId());
        suite.setEnabled(request.isEnabled());
        suite.setStopOnFailure(request.isStopOnFailure());
        suite.setParallelism(request.getParallelism() > 0 ? request.getParallelism() : 1);

        TestSuite saved = testSuiteRepository.save(suite);

        testSuiteCaseRepository.deleteBySuiteId(id);
        if (request.getTestCaseIds() != null) {
            int seq = 1;
            for (String tcId : request.getTestCaseIds()) {
                TestSuiteCase tsc = new TestSuiteCase();
                tsc.setSuiteId(saved.getId());
                tsc.setTestCaseId(tcId);
                tsc.setSequenceOrder(seq++);
                testSuiteCaseRepository.save(tsc);
            }
        }

        schedulerService.scheduleSuite(saved);
        return toDto(saved);
    }

    public List<TestSuiteDtos.TestSuiteDto> getSuites(String appId) {
        return testSuiteRepository.findByAppId(appId).stream().map(this::toDto).toList();
    }

    public TestSuiteDtos.TestSuiteDto getSuite(String id) {
        TestSuite suite = testSuiteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestSuite", id));
        return toDto(suite);
    }

    @Transactional
    public void deleteSuite(String id) {
        schedulerService.cancelSuite(id);
        testSuiteCaseRepository.deleteBySuiteId(id);
        testSuiteRepository.deleteById(id);
    }

    @Async("executionTaskExecutor")
    public void runSuite(String suiteId, String triggeredBy) {
        TestSuite suite = testSuiteRepository.findById(suiteId).orElse(null);
        if (suite == null) {
            log.error("Suite not found for execution: {}", suiteId);
            return;
        }

        List<TestSuiteCase> suiteCases = testSuiteCaseRepository.findBySuiteIdOrderBySequenceOrderAsc(suiteId);
        if (suiteCases.isEmpty()) {
            log.warn("Suite {} has no test cases configured. Skipping execution.", suiteId);
            return;
        }

        SuiteExecution suiteExec = new SuiteExecution();
        suiteExec.setSuiteId(suiteId);
        suiteExec.setStatus(SuiteExecution.Status.RUNNING);
        suiteExec.setTriggeredBy(triggeredBy);
        suiteExec.setStartedAt(Instant.now());
        suiteExec.setTotalCases(suiteCases.size());
        SuiteExecution savedSuiteExec = suiteExecutionRepository.save(suiteExec);

        int passed = 0;
        int failed = 0;
        boolean aborted = false;

        for (TestSuiteCase sc : suiteCases) {
            SuiteExecutionCase sec = new SuiteExecutionCase();
            sec.setSuiteExecutionId(savedSuiteExec.getId());
            sec.setTestCaseId(sc.getTestCaseId());

            if (aborted) {
                sec.setStatus("SKIPPED");
                suiteExecutionCaseRepository.save(sec);
                continue;
            }

            sec.setStatus("RUNNING");
            SuiteExecutionCase savedSec = suiteExecutionCaseRepository.save(sec);

            long start = System.currentTimeMillis();
            try {
                ExecutionDtos.TriggerExecutionRequest triggerReq = new ExecutionDtos.TriggerExecutionRequest();
                triggerReq.setTestCaseId(sc.getTestCaseId());
                triggerReq.setEnvironmentId(suite.getEnvironmentId());

                ExecutionDtos.ExecutionDto run = executionService.triggerExecution(triggerReq, triggeredBy);
                savedSec.setExecutionId(run.getId());
                suiteExecutionCaseRepository.save(savedSec);

                // Block/Wait for execution to finish
                Execution.Status runStatus = waitExecution(run.getId());
                savedSec.setDurationMs(System.currentTimeMillis() - start);

                if (runStatus == Execution.Status.PASSED) {
                    savedSec.setStatus("PASSED");
                    passed++;
                } else {
                    savedSec.setStatus("FAILED");
                    failed++;
                    aborted = true; // Stop suite execution on first failure
                }
            } catch (Exception e) {
                log.error("Error executing suite case {}: {}", sc.getTestCaseId(), e.getMessage());
                savedSec.setStatus("ERROR");
                savedSec.setDurationMs(System.currentTimeMillis() - start);
                failed++;
                aborted = true;
            }
            suiteExecutionCaseRepository.save(savedSec);
        }

        savedSuiteExec.setCompletedAt(Instant.now());
        savedSuiteExec.setDurationMs(System.currentTimeMillis() - savedSuiteExec.getStartedAt().toEpochMilli());
        savedSuiteExec.setPassedCases(passed);
        savedSuiteExec.setFailedCases(failed);

        if (failed == 0) {
            savedSuiteExec.setStatus(SuiteExecution.Status.PASSED);
        } else {
            savedSuiteExec.setStatus(SuiteExecution.Status.FAILED);
        }
        suiteExecutionRepository.save(savedSuiteExec);
    }

    private Execution.Status waitExecution(String execId) {
        while (true) {
            Optional<Execution> opt = executionRepository.findById(execId);
            if (opt.isPresent()) {
                Execution.Status s = opt.get().getStatus();
                if (s != Execution.Status.QUEUED && s != Execution.Status.RUNNING) {
                    return s;
                }
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return Execution.Status.CANCELLED;
            }
        }
    }

    public List<TestSuiteDtos.SuiteExecutionDto> getSuiteExecutions(String suiteId) {
        return suiteExecutionRepository.findBySuiteIdOrderByCreatedAtDesc(suiteId).stream()
                .map(this::toDto)
                .toList();
    }

    public TestSuiteDtos.SuiteExecutionDto getSuiteExecutionDetail(String execId) {
        SuiteExecution se = suiteExecutionRepository.findById(execId)
                .orElseThrow(() -> new ResourceNotFoundException("SuiteExecution", execId));
        return toDtoWithDetails(se);
    }

    private TestSuiteDtos.TestSuiteDto toDto(TestSuite suite) {
        TestSuiteDtos.TestSuiteDto dto = new TestSuiteDtos.TestSuiteDto();
        dto.setId(suite.getId());
        dto.setAppId(suite.getAppId());
        dto.setName(suite.getName());
        dto.setDescription(suite.getDescription());
        dto.setCronExpression(suite.getCronExpression());
        dto.setEnvironmentId(suite.getEnvironmentId());
        dto.setEnabled(suite.isEnabled());
        dto.setStopOnFailure(suite.isStopOnFailure());
        dto.setParallelism(suite.getParallelism() > 0 ? suite.getParallelism() : 1);
        dto.setCreatedBy(suite.getCreatedBy());
        dto.setCreatedAt(suite.getCreatedAt() != null ? suite.getCreatedAt().toString() : null);
        dto.setUpdatedAt(suite.getUpdatedAt() != null ? suite.getUpdatedAt().toString() : null);

        List<String> tcIds = testSuiteCaseRepository.findBySuiteIdOrderBySequenceOrderAsc(suite.getId()).stream()
                .map(TestSuiteCase::getTestCaseId)
                .toList();
        dto.setTestCaseIds(tcIds);

        return dto;
    }

    private TestSuiteDtos.SuiteExecutionDto toDto(SuiteExecution se) {
        TestSuiteDtos.SuiteExecutionDto dto = new TestSuiteDtos.SuiteExecutionDto();
        dto.setId(se.getId());
        dto.setSuiteId(se.getSuiteId());
        dto.setStatus(se.getStatus().name());
        dto.setTriggeredBy(se.getTriggeredBy());
        dto.setStartedAt(se.getStartedAt() != null ? se.getStartedAt().toString() : null);
        dto.setCompletedAt(se.getCompletedAt() != null ? se.getCompletedAt().toString() : null);
        dto.setDurationMs(se.getDurationMs());
        dto.setTotalCases(se.getTotalCases());
        dto.setPassedCases(se.getPassedCases());
        dto.setFailedCases(se.getFailedCases());
        dto.setErrorMessage(se.getErrorMessage());
        dto.setCreatedAt(se.getCreatedAt() != null ? se.getCreatedAt().toString() : null);

        testSuiteRepository.findById(se.getSuiteId()).ifPresent(suite -> dto.setSuiteName(suite.getName()));
        return dto;
    }

    private TestSuiteDtos.SuiteExecutionDto toDtoWithDetails(SuiteExecution se) {
        TestSuiteDtos.SuiteExecutionDto dto = toDto(se);
        List<TestSuiteDtos.SuiteExecutionCaseDto> caseDtos = new ArrayList<>();

        for (SuiteExecutionCase sec : suiteExecutionCaseRepository.findBySuiteExecutionId(se.getId())) {
            TestSuiteDtos.SuiteExecutionCaseDto cDto = new TestSuiteDtos.SuiteExecutionCaseDto();
            cDto.setId(sec.getId());
            cDto.setTestCaseId(sec.getTestCaseId());
            cDto.setExecutionId(sec.getExecutionId());
            cDto.setStatus(sec.getStatus());
            cDto.setDurationMs(sec.getDurationMs());

            testCaseRepository.findById(sec.getTestCaseId()).ifPresent(tc -> cDto.setTestCaseName(tc.getName()));
            caseDtos.add(cDto);
        }
        dto.setCases(caseDtos);
        return dto;
    }
}
