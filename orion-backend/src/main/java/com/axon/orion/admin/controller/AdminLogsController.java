package com.axon.orion.admin.controller;

import com.axon.orion.admin.dto.AdminDtos;
import com.axon.orion.admin.service.LogViewerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminLogsController {

    private final LogViewerService logViewerService;

    @GetMapping("/api/admin/logs")
    public ResponseEntity<List<AdminDtos.LogEntryDto>> getLogs(
            @RequestParam(defaultValue = "1") int days,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String search) {
        int daysScope = (days <= 1) ? 1 : 7;
        return ResponseEntity.ok(logViewerService.getLogs(daysScope, level, search));
    }

    @GetMapping("/api/admin/logs/export")
    public ResponseEntity<byte[]> exportLogs(
            @RequestParam(defaultValue = "1") int days,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String search) {
        int daysScope = (days <= 1) ? 1 : 7;
        String logContent = logViewerService.exportRawLogs(daysScope, level, search);
        byte[] content = logContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.setContentDisposition(org.springframework.http.ContentDisposition.attachment()
                .filename(String.format("orion-logs-%ddays.log", daysScope))
                .build());

        return ResponseEntity.ok()
                .headers(headers)
                .body(content);
    }
}
