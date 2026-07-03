package com.axon.orion.global_config.controller;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.global_config.dto.GlobalEnvConfigDtos;
import com.axon.orion.global_config.service.GlobalEnvConfigService;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/global/env-configs")
@RequiredArgsConstructor
public class GlobalEnvConfigController {

    private final GlobalEnvConfigService service;

    @GetMapping
    public ResponseEntity<PagedResponse<GlobalEnvConfigDtos.GlobalEnvConfigDto>> listConfigs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(service.listConfigs(page, size, search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GlobalEnvConfigDtos.GlobalEnvConfigDto> getConfig(@PathVariable String id) {
        return ResponseEntity.ok(service.getConfig(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GlobalEnvConfigDtos.GlobalEnvConfigDto> createConfig(
            @Valid @RequestBody GlobalEnvConfigDtos.CreateGlobalEnvConfigRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.createConfig(request, user.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GlobalEnvConfigDtos.GlobalEnvConfigDto> updateConfig(
            @PathVariable String id,
            @Valid @RequestBody GlobalEnvConfigDtos.UpdateGlobalEnvConfigRequest request) {
        return ResponseEntity.ok(service.updateConfig(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteConfig(@PathVariable String id) {
        service.deleteConfig(id);
        return ResponseEntity.noContent().build();
    }
}
