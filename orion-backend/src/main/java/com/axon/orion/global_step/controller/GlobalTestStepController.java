package com.axon.orion.global_step.controller;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.global_step.dto.GlobalTestStepDtos;
import com.axon.orion.global_step.service.GlobalTestStepService;
import com.axon.orion.testcase.entity.TestStep;
import com.axon.orion.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/global/test-steps")
@RequiredArgsConstructor
public class GlobalTestStepController {

    private final GlobalTestStepService service;

    @GetMapping
    public ResponseEntity<PagedResponse<GlobalTestStepDtos.GlobalTestStepDto>> listSteps(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TestStep.StepType stepType) {
        return ResponseEntity.ok(service.listSteps(page, size, search, stepType));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GlobalTestStepDtos.GlobalTestStepDto> getStep(@PathVariable String id) {
        return ResponseEntity.ok(service.getStep(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GlobalTestStepDtos.GlobalTestStepDto> createStep(
            @Valid @RequestBody GlobalTestStepDtos.CreateGlobalTestStepRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.createStep(request, user.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GlobalTestStepDtos.GlobalTestStepDto> updateStep(
            @PathVariable String id,
            @Valid @RequestBody GlobalTestStepDtos.CreateGlobalTestStepRequest request) {
        return ResponseEntity.ok(service.updateStep(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteStep(@PathVariable String id) {
        service.deleteStep(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/promote/{stepId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TESTER')")
    public ResponseEntity<GlobalTestStepDtos.GlobalTestStepDto> promoteStep(
            @PathVariable String stepId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.promoteStep(stepId, user.getId()));
    }
}
