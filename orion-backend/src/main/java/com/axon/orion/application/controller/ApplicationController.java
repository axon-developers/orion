package com.axon.orion.application.controller;

import com.axon.orion.application.dto.ApplicationDtos;
import com.axon.orion.application.service.ApplicationService;
import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @GetMapping
    public ResponseEntity<PagedResponse<ApplicationDtos.ApplicationDto>> listApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "updatedAt,desc") String sort,
            @RequestParam(required = false) Boolean isActive) {
        return ResponseEntity.ok(applicationService.listApplications(page, size, search, sort, isActive));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationDtos.ApplicationDto> getApplication(@PathVariable String id) {
        return ResponseEntity.ok(applicationService.getApplicationById(id));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<ApplicationDtos.ApplicationSummaryDto> getApplicationSummary(@PathVariable String id) {
        return ResponseEntity.ok(applicationService.getApplicationSummary(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<ApplicationDtos.ApplicationDto> createApplication(
            @Valid @RequestBody ApplicationDtos.CreateApplicationRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.createApplication(request, user.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<ApplicationDtos.ApplicationDto> updateApplication(
            @PathVariable String id,
            @Valid @RequestBody ApplicationDtos.UpdateApplicationRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(applicationService.updateApplication(id, request, user.getId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<Void> deleteApplication(
            @PathVariable String id,
            @AuthenticationPrincipal User user) {
        applicationService.deleteApplication(id, user.getId());
        return ResponseEntity.noContent().build();
    }
}
