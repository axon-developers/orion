package com.axon.orion.execution.controller;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.execution.dto.ExecutionDtos;
import com.axon.orion.execution.entity.Execution;
import com.axon.orion.execution.service.ExecutionReportService;
import com.axon.orion.execution.service.ExecutionService;
import com.axon.orion.testcase.repository.TestCaseRepository;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;
    private final ExecutionReportService reportService;
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
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return ResponseEntity.ok(
                executionService.listExecutions(page, size, testCaseId, environmentId, status, search, sort));
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

    @PostMapping("/api/executions/{execId}/email")
    public ResponseEntity<Void> emailReport(
            @PathVariable String execId,
            @Valid @RequestBody ExecutionDtos.EmailReportRequest request) {
        reportService.sendExecutionReport(execId, request.getRecipientEmail());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/executions/{execId}/report")
    public ResponseEntity<byte[]> downloadReport(@PathVariable String execId) {
        String htmlReport = reportService.getHtmlReport(execId);
        byte[] content = htmlReport.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        headers.setContentDisposition(org.springframework.http.ContentDisposition.attachment()
                .filename("execution-report-" + execId + ".html")
                .build());
                
        return new ResponseEntity<>(content, headers, HttpStatus.OK);
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
                executionService.listExecutions(page, size, tcId, null, null, null, "createdAt,desc"));
    }

    @GetMapping("/api/dashboard/execution-stats")
    public ResponseEntity<ExecutionDtos.ExecutionStatsDto> getExecutionStats() {
        return ResponseEntity.ok(executionService.getDashboardStats());
    }

    @GetMapping("/api/dashboard/execution-trend")
    public ResponseEntity<java.util.List<ExecutionDtos.ExecutionTrendDto>> getExecutionTrend(
            @RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(executionService.getDashboardTrend(days));
    }

    @GetMapping(value = "/api/executions/{execId}/steps/{stepId}/screenshots/{filename}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<Resource> getScreenshot(
            @PathVariable String execId,
            @PathVariable String stepId,
            @PathVariable String filename) {
        
        // Basic path traversal validation
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }

        try {
            java.nio.file.Path path = java.nio.file.Paths.get("storage/screenshots", filename);
            if (!java.nio.file.Files.exists(path)) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(path.toUri());
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping(value = "/api/extension/download", produces = "application/zip")
    public ResponseEntity<byte[]> downloadExtension() {
        try {
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(baos);
            
            java.nio.file.Path sourcePath = java.nio.file.Paths.get("orion-extension");
            if (!java.nio.file.Files.exists(sourcePath)) {
                sourcePath = java.nio.file.Paths.get("../orion-extension");
            }

            if (!java.nio.file.Files.exists(sourcePath)) {
                log.error("Extension folder not found at path: {}", sourcePath.toAbsolutePath());
                return ResponseEntity.notFound().build();
            }

            final java.nio.file.Path finalSourcePath = sourcePath;
            java.nio.file.Files.walk(sourcePath)
                .filter(path -> !java.nio.file.Files.isDirectory(path))
                .forEach(path -> {
                    String zipEntryName = finalSourcePath.relativize(path).toString().replace("\\", "/");
                    try {
                        zos.putNextEntry(new java.util.zip.ZipEntry(zipEntryName));
                        java.nio.file.Files.copy(path, zos);
                        zos.closeEntry();
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to add file to ZIP: " + path, e);
                    }
                });
            zos.close();

            byte[] zipBytes = baos.toByteArray();
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.parseMediaType("application/zip"));
            headers.setContentDisposition(org.springframework.http.ContentDisposition.attachment()
                    .filename("orion-test-recorder.zip")
                    .build());
                    
            return new ResponseEntity<>(zipBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            log.error("Failed to build extension ZIP: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
