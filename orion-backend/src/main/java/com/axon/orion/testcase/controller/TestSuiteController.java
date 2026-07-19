package com.axon.orion.testcase.controller;

import com.axon.orion.testcase.dto.TestSuiteDtos;
import com.axon.orion.testcase.service.TestSuiteService;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TestSuiteController {

    private final TestSuiteService testSuiteService;

    @PostMapping("/api/applications/{appId}/suites")
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<TestSuiteDtos.TestSuiteDto> createSuite(
            @PathVariable String appId,
            @Valid @RequestBody TestSuiteDtos.CreateTestSuiteRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(testSuiteService.createSuite(appId, request, user.getId()));
    }

    @PutMapping("/api/applications/{appId}/suites/{id}")
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<TestSuiteDtos.TestSuiteDto> updateSuite(
            @PathVariable String appId,
            @PathVariable String id,
            @Valid @RequestBody TestSuiteDtos.CreateTestSuiteRequest request) {
        return ResponseEntity.ok(testSuiteService.updateSuite(id, request));
    }

    @GetMapping("/api/applications/{appId}/suites")
    public ResponseEntity<List<TestSuiteDtos.TestSuiteDto>> getSuites(@PathVariable String appId) {
        return ResponseEntity.ok(testSuiteService.getSuites(appId));
    }

    @GetMapping("/api/applications/{appId}/suites/{id}")
    public ResponseEntity<TestSuiteDtos.TestSuiteDto> getSuite(
            @PathVariable String appId, @PathVariable String id) {
        return ResponseEntity.ok(testSuiteService.getSuite(id));
    }

    @DeleteMapping("/api/applications/{appId}/suites/{id}")
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<Void> deleteSuite(
            @PathVariable String appId, @PathVariable String id) {
        testSuiteService.deleteSuite(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/applications/{appId}/suites/{id}/run")
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<Void> runSuite(
            @PathVariable String appId,
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        testSuiteService.runSuite(id, user.getId());
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/api/applications/{appId}/suites/{id}/executions")
    public ResponseEntity<List<TestSuiteDtos.SuiteExecutionDto>> getSuiteExecutions(
            @PathVariable String appId, @PathVariable String id) {
        return ResponseEntity.ok(testSuiteService.getSuiteExecutions(id));
    }

    @GetMapping("/api/applications/{appId}/suites/executions/{execId}")
    public ResponseEntity<TestSuiteDtos.SuiteExecutionDto> getSuiteExecutionDetail(
            @PathVariable String appId, @PathVariable String execId) {
        return ResponseEntity.ok(testSuiteService.getSuiteExecutionDetail(execId));
    }
}
