package com.axon.orion.application.controller;

import com.axon.orion.application.entity.ApplicationCollaborator;
import com.axon.orion.application.service.ApplicationCollaboratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/applications/{appId}/collaborators")
@RequiredArgsConstructor
public class ApplicationCollaboratorController {

    private final ApplicationCollaboratorService applicationCollaboratorService;

    @GetMapping
    public ResponseEntity<List<ApplicationCollaborator>> listCollaborators(@PathVariable String appId) {
        return ResponseEntity.ok(applicationCollaboratorService.listCollaborators(appId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<ApplicationCollaborator> addCollaborator(
            @PathVariable String appId,
            @RequestParam String username) {
        return ResponseEntity.ok(applicationCollaboratorService.addCollaborator(appId, username));
    }

    @DeleteMapping("/{username}")
    @PreAuthorize("hasRole('ADMIN') or @applicationAccessService.canEdit(#appId, principal)")
    public ResponseEntity<Void> removeCollaborator(
            @PathVariable String appId,
            @PathVariable String username) {
        applicationCollaboratorService.removeCollaborator(appId, username);
        return ResponseEntity.noContent().build();
    }
}
