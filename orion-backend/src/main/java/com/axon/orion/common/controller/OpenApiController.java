package com.axon.orion.common.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
public class OpenApiController {

    @GetMapping(value = "/api/openapi.yaml", produces = "text/yaml;charset=UTF-8")
    public ResponseEntity<String> getOpenApiYaml() {
        try {
            Resource resource = new ClassPathResource("openapi.yaml");
            if (!resource.exists()) {
                log.error("openapi.yaml resource not found on classpath");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("# openapi.yaml not found");
            }
            try (InputStream is = resource.getInputStream()) {
                String content = StreamUtils.copyToString(is, StandardCharsets.UTF_8);
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.parseMediaType("text/yaml;charset=UTF-8"));
                headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"openapi.yaml\"");
                return new ResponseEntity<>(content, headers, HttpStatus.OK);
            }
        } catch (Exception e) {
            log.error("Error reading openapi.yaml: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("# Error loading openapi.yaml: " + e.getMessage());
        }
    }
}
