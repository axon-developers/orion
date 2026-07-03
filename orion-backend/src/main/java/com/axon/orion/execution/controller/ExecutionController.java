package com.axon.orion.execution.controller;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.service.ExecutionService;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;
    private final TestCaseRepository testCaseRepository;

    @PostMapping("/api/executions")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<ExecutionDtos.ExecutionDto> triggerExecution(
            @Valid @RequestBody ExecutionDtos.TriggerExecutionRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(executionService.triggerExecution(request, user.getId()));
    }

    @GetMapping("/api/executions")
    public ResponseEntity<PagedResponse<ExecutionDtos.ExecutionDto>> listExecutions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String testCaseId,
            @RequestParam(required = false) String environmentId,
            @RequestParam(required = false) Execution.Status status,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return ResponseEntity.ok(
                executionService.listExecutions(page, size, testCaseId, environmentId, status, sort));
    }

    @GetMapping("/api/executions/{execId}")
    public ResponseEntity<ExecutionDtos.ExecutionDetailDto> getExecution(@PathVariable String execId) {
        return ResponseEntity.ok(executionService.getExecutionDetail(execId));
    }

    @GetMapping("/api/executions/{execId}/logs")
    public ResponseEntity<List<ExecutionDtos.ExecutionStepLogDto>> getStepLogs(@PathVariable String execId) {
        return ResponseEntity.ok(executionService.getStepLogs(execId));
    }

    @GetMapping(value = "/api/executions/{execId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamExecution(@PathVariable String execId) {
        return executionService.streamExecution(execId);
    }

    @PostMapping("/api/executions/{execId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<ExecutionDtos.ExecutionDto> cancelExecution(@PathVariable String execId) {
        return ResponseEntity.ok(executionService.cancelExecution(execId));
    }

    @PostMapping("/api/executions/{execId}/rerun")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<ExecutionDtos.ExecutionDto> rerunExecution(
            @PathVariable String execId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(executionService.rerunExecution(execId, user.getId()));
    }

    @GetMapping("/api/applications/{appId}/executions")
    public ResponseEntity<PagedResponse<ExecutionDtos.ExecutionDto>> listAppExecutions(
            @PathVariable String appId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return ResponseEntity.ok(
                executionService.listAppExecutions(appId, page, size, sort));
    }

    @GetMapping("/api/testcases/{tcId}/executions")
    public ResponseEntity<PagedResponse<ExecutionDtos.ExecutionDto>> listTestCaseExecutions(
            @PathVariable String tcId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                executionService.listExecutions(page, size, tcId, null, null, "createdAt,desc"));
    }

    @GetMapping("/api/dashboard/execution-stats")
    public ResponseEntity<ExecutionDtos.ExecutionStatsDto> getExecutionStats() {
        return ResponseEntity.ok(executionService.getDashboardStats());
    }
}
