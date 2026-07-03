package com.axon.orion.execution.service;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.environment.service.EnvironmentService;
import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.engine.ExecutionEngine;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.entity.ExecutionStepLog;
import com.axon.orion.execution.repository.ExecutionRepository;
import com.axon.orion.execution.repository.ExecutionStepLogRepository;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.testcase.repository.TestStepRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionService {

    private final ExecutionRepository executionRepository;
    private final ExecutionStepLogRepository stepLogRepository;
    private final TestCaseRepository testCaseRepository;
    private final TestStepRepository testStepRepository;
    private final EnvironmentService environmentService;
    private final ExecutionEngine executionEngine;

    // SSE emitter registry for real-time updates
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    @Transactional
    public ExecutionDtos.ExecutionDto triggerExecution(
            ExecutionDtos.TriggerExecutionRequest request, String userId) {
        // Validate test case and environment exist
        if (!testCaseRepository.existsById(request.getTestCaseId())) {
            throw new ResourceNotFoundException("TestCase", request.getTestCaseId());
        }

        // Resolve variable context (global + environment)
        Map<String, String> variableContext = new HashMap<>(environmentService.getResolvedVariableContext(request.getEnvironmentId()));
        if (request.getEnvironmentId() != null) {
            variableContext.put("__environmentId", request.getEnvironmentId());
        }

        // Create execution record
        Execution execution = new Execution();
        execution.setTestCaseId(request.getTestCaseId());
        execution.setEnvironmentId(request.getEnvironmentId());
        execution.setStatus(Execution.Status.QUEUED);
        execution.setTriggeredBy(userId);
        Execution saved = executionRepository.save(execution);

        // Launch async execution
        executionEngine.execute(saved.getId(), variableContext);

        return ExecutionDtos.toDto(saved);
    }

    public PagedResponse<ExecutionDtos.ExecutionDto> listExecutions(
            int page, int size, String testCaseId, String environmentId,
            Execution.Status status, String sort) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"createdAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<Execution> page_ = executionRepository.findAllWithFilters(testCaseId, environmentId, status, pageRequest);
        return PagedResponse.of(page_.getContent().stream().map(ExecutionDtos::toDto).toList(),
                page, size, page_.getTotalElements());
    }

    public PagedResponse<ExecutionDtos.ExecutionDto> listAppExecutions(
            String appId, int page, int size, String sort) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"createdAt", "desc"};
        Sort.Direction dir = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(dir, sortParts[0]));
        Page<Execution> page_ = executionRepository.findByAppId(appId, pageRequest);
        return PagedResponse.of(page_.getContent().stream().map(ExecutionDtos::toDto).toList(),
                page, size, page_.getTotalElements());
    }

    public ExecutionDtos.ExecutionDetailDto getExecutionDetail(String execId) {
        Execution exec = findById(execId);
        ExecutionDtos.ExecutionDetailDto dto = new ExecutionDtos.ExecutionDetailDto();
        ExecutionDtos.ExecutionDto base = ExecutionDtos.toDto(exec);
        copyBaseFields(base, dto);

        List<ExecutionStepLog> logs = stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId);
        dto.setStepLogs(logs.stream().map(ExecutionDtos::toStepLogDto).toList());
        return dto;
    }

    public List<ExecutionDtos.ExecutionStepLogDto> getStepLogs(String execId) {
        findById(execId);
        return stepLogRepository.findByExecutionIdOrderBySequenceOrderAsc(execId)
                .stream().map(ExecutionDtos::toStepLogDto).toList();
    }

    @Transactional
    public ExecutionDtos.ExecutionDto cancelExecution(String execId) {
        Execution exec = findById(execId);
        if (exec.getStatus() == Execution.Status.QUEUED || exec.getStatus() == Execution.Status.RUNNING) {
            exec.setStatus(Execution.Status.CANCELLED);
            executionRepository.save(exec);
        }
        return ExecutionDtos.toDto(exec);
    }

    @Transactional
    public ExecutionDtos.ExecutionDto rerunExecution(String execId, String userId) {
        Execution original = findById(execId);
        ExecutionDtos.TriggerExecutionRequest request = new ExecutionDtos.TriggerExecutionRequest();
        request.setTestCaseId(original.getTestCaseId());
        request.setEnvironmentId(original.getEnvironmentId());
        return triggerExecution(request, userId);
    }

    public SseEmitter streamExecution(String execId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.computeIfAbsent(execId, k -> new ArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(execId, emitter));
        emitter.onTimeout(() -> removeEmitter(execId, emitter));

        // Send current state immediately
        try {
            Execution exec = findById(execId);
            emitter.send(SseEmitter.event()
                    .name("execution-update")
                    .data(ExecutionDtos.toDto(exec)));
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
        return emitter;
    }

    public void notifyExecutionUpdate(String execId, ExecutionDtos.ExecutionDto dto) {
        List<SseEmitter> emitterList = emitters.getOrDefault(execId, List.of());
        emitterList.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("execution-update").data(dto));
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        });
    }

    public ExecutionDtos.ExecutionStatsDto getDashboardStats() {
        long total = executionRepository.count();
        long passed = executionRepository.findAllWithFilters(null, null, Execution.Status.PASSED,
                PageRequest.of(0, 1)).getTotalElements();
        long failed = executionRepository.findAllWithFilters(null, null, Execution.Status.FAILED,
                PageRequest.of(0, 1)).getTotalElements();
        long running = executionRepository.findAllWithFilters(null, null, Execution.Status.RUNNING,
                PageRequest.of(0, 1)).getTotalElements();

        ExecutionDtos.ExecutionStatsDto stats = new ExecutionDtos.ExecutionStatsDto();
        stats.setTotalExecutions(total);
        stats.setPassedExecutions(passed);
        stats.setFailedExecutions(failed);
        stats.setRunningExecutions(running);
        stats.setPassRate(total > 0 ? (double) passed / total * 100 : 0);
        return stats;
    }

    private Execution findById(String execId) {
        return executionRepository.findById(execId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", execId));
    }

    private void removeEmitter(String execId, SseEmitter emitter) {
        emitters.computeIfPresent(execId, (k, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }

    private void copyBaseFields(ExecutionDtos.ExecutionDto src, ExecutionDtos.ExecutionDetailDto dst) {
        dst.setId(src.getId());
        dst.setTestCaseId(src.getTestCaseId());
        dst.setEnvironmentId(src.getEnvironmentId());
        dst.setStatus(src.getStatus());
        dst.setTriggeredBy(src.getTriggeredBy());
        dst.setStartedAt(src.getStartedAt());
        dst.setCompletedAt(src.getCompletedAt());
        dst.setDurationMs(src.getDurationMs());
        dst.setTotalSteps(src.getTotalSteps());
        dst.setPassedSteps(src.getPassedSteps());
        dst.setFailedSteps(src.getFailedSteps());
        dst.setErrorMessage(src.getErrorMessage());
        dst.setCreatedAt(src.getCreatedAt());
    }
}
