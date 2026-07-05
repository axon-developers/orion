package com.axon.orion.testcase.controller;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.testcase.dto.TestCaseDtos;
import com.axon.orion.testcase.entity.TestCase;
import com.axon.orion.testcase.service.TestCaseService;
import com.axon.orion.testcase.service.TestStepService;
import com.axon.orion.testcase.service.TestCaseImportService;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TestCaseController {

    private final TestCaseService testCaseService;
    private final TestStepService testStepService;
    private final TestCaseImportService testCaseImportService;

    // ── Test Case CRUD ───────────────────────────────────────────────────────

    @GetMapping("/api/applications/{appId}/testcases")
    public ResponseEntity<PagedResponse<TestCaseDtos.TestCaseDto>> listTestCases(
            @PathVariable String appId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TestCase.Status status,
            @RequestParam(required = false) TestCase.Priority priority,
            @RequestParam(defaultValue = "updatedAt,desc") String sort) {
        return ResponseEntity.ok(
                testCaseService.listTestCases(appId, page, size, search, status, priority, sort));
    }

    @GetMapping("/api/applications/{appId}/testcases/{tcId}")
    public ResponseEntity<TestCaseDtos.TestCaseDetailDto> getTestCase(
            @PathVariable String appId, @PathVariable String tcId) {
        return ResponseEntity.ok(testCaseService.getTestCaseWithSteps(appId, tcId));
    }

    @PostMapping("/api/applications/{appId}/testcases")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestCaseDto> createTestCase(
            @PathVariable String appId,
            @Valid @RequestBody TestCaseDtos.CreateTestCaseRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(testCaseService.createTestCase(appId, request, user.getId()));
    }

    @PostMapping("/api/applications/{appId}/testcases/import")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestCaseDto> importOpenApiTestCase(
            @PathVariable String appId,
            @RequestParam("name") String name,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(testCaseService.importOpenApiTestCase(appId, name, file, user.getId()));
    }

    @PutMapping("/api/applications/{appId}/testcases/{tcId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestCaseDto> updateTestCase(
            @PathVariable String appId,
            @PathVariable String tcId,
            @Valid @RequestBody TestCaseDtos.UpdateTestCaseRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(testCaseService.updateTestCase(appId, tcId, request, user.getId()));
    }

    @DeleteMapping("/api/applications/{appId}/testcases/{tcId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<Void> deleteTestCase(
            @PathVariable String appId, @PathVariable String tcId,
            @AuthenticationPrincipal User user) {
        testCaseService.deleteTestCase(appId, tcId, user.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/applications/{appId}/testcases/{tcId}/clone")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestCaseDto> cloneTestCase(
            @PathVariable String appId, @PathVariable String tcId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(testCaseService.cloneTestCase(appId, tcId, user.getId()));
    }

    @GetMapping("/api/applications/{appId}/testcases/{tcId}/export")
    public ResponseEntity<String> exportTestCase(
            @PathVariable String appId, @PathVariable String tcId) {
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .header("Content-Disposition", "attachment; filename=\"testcase-" + tcId + ".json\"")
                .body(testCaseService.exportTestCase(appId, tcId));
    }

    // ── Test Step CRUD ───────────────────────────────────────────────────────

    @GetMapping("/api/testcases/{tcId}/steps")
    public ResponseEntity<List<TestCaseDtos.TestStepDto>> listSteps(@PathVariable String tcId) {
        return ResponseEntity.ok(testStepService.listSteps(tcId));
    }

    @GetMapping("/api/testcases/{tcId}/steps/{stepId}")
    public ResponseEntity<TestCaseDtos.TestStepDto> getStep(
            @PathVariable String tcId, @PathVariable String stepId) {
        return ResponseEntity.ok(testStepService.getStep(tcId, stepId));
    }

    @PostMapping("/api/testcases/{tcId}/steps")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestStepDto> addStep(
            @PathVariable String tcId,
            @Valid @RequestBody TestCaseDtos.CreateTestStepRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(testStepService.addStep(tcId, request));
    }

    @PutMapping("/api/testcases/{tcId}/steps/{stepId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<TestCaseDtos.TestStepDto> updateStep(
            @PathVariable String tcId,
            @PathVariable String stepId,
            @Valid @RequestBody TestCaseDtos.CreateTestStepRequest request) {
        return ResponseEntity.ok(testStepService.updateStep(tcId, stepId, request));
    }

    @DeleteMapping("/api/testcases/{tcId}/steps/{stepId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<Void> deleteStep(
            @PathVariable String tcId, @PathVariable String stepId) {
        testStepService.deleteStep(tcId, stepId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/testcases/{tcId}/steps/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<List<TestCaseDtos.TestStepDto>> reorderSteps(
            @PathVariable String tcId,
            @Valid @RequestBody TestCaseDtos.ReorderRequest request) {
        return ResponseEntity.ok(testStepService.reorderSteps(tcId, request));
    }

    @PostMapping("/api/testcases/{tcId}/steps/bulk")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<List<TestCaseDtos.TestStepDto>> bulkSaveSteps(
            @PathVariable String tcId,
            @Valid @RequestBody TestCaseDtos.BulkSaveRequest request) {
        return ResponseEntity.ok(testStepService.bulkSaveSteps(tcId, request));
    }

    @PostMapping("/api/testcases/{tcId}/import")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<List<TestCaseDtos.TestStepDto>> importCollection(
            @PathVariable String tcId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String type) {
        return ResponseEntity.ok(testCaseImportService.importCollection(tcId, file, type));
    }
}
