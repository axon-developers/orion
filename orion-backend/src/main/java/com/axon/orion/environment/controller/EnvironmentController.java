package com.axon.orion.environment.controller;

import com.axon.orion.environment.dto.EnvironmentDtos;
import com.axon.orion.environment.service.EnvironmentService;
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
@RequestMapping("/api/applications/{appId}/environments")
@PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
@RequiredArgsConstructor
public class EnvironmentController {

    private final EnvironmentService environmentService;

    @GetMapping
    public ResponseEntity<List<EnvironmentDtos.EnvironmentDto>> listEnvironments(@PathVariable String appId) {
        return ResponseEntity.ok(environmentService.listEnvironments(appId));
    }

    @GetMapping("/{envId}")
    public ResponseEntity<EnvironmentDtos.EnvironmentDto> getEnvironment(
            @PathVariable String appId, @PathVariable String envId) {
        return ResponseEntity.ok(environmentService.getEnvironment(appId, envId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<EnvironmentDtos.EnvironmentDto> createEnvironment(
            @PathVariable String appId,
            @Valid @RequestBody EnvironmentDtos.CreateEnvironmentRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(environmentService.createEnvironment(appId, request, user.getId()));
    }

    @PutMapping("/{envId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<EnvironmentDtos.EnvironmentDto> updateEnvironment(
            @PathVariable String appId,
            @PathVariable String envId,
            @Valid @RequestBody EnvironmentDtos.UpdateEnvironmentRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(environmentService.updateEnvironment(appId, envId, request, user.getId()));
    }

    @DeleteMapping("/{envId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<Void> deleteEnvironment(
            @PathVariable String appId,
            @PathVariable String envId,
            @AuthenticationPrincipal User user) {
        environmentService.deleteEnvironment(appId, envId, user.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{envId}/clone")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<EnvironmentDtos.EnvironmentDto> cloneEnvironment(
            @PathVariable String appId,
            @PathVariable String envId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(environmentService.cloneEnvironment(appId, envId, user.getId()));
    }

    @PutMapping("/{envId}/default")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<EnvironmentDtos.EnvironmentDto> setDefaultEnvironment(
            @PathVariable String appId,
            @PathVariable String envId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(environmentService.setDefaultEnvironment(appId, envId, user.getId()));
    }
}
