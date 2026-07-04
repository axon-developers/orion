package com.axon.orion.environment.service;

import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.audit.service.AuditService;
import com.axon.orion.common.exception.DuplicateResourceException;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.dto.EnvironmentDtos;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.repository.EnvironmentRepository;
import com.axon.orion.global_config.repository.GlobalEnvConfigRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnvironmentService {

    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final GlobalEnvConfigRepository globalEnvConfigRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public List<EnvironmentDtos.EnvironmentDto> listEnvironments(String appId) {
        validateAppExists(appId);
        return environmentRepository.findByAppIdOrderByCreatedAtAsc(appId).stream()
                .map(e -> toDto(e, true))
                .toList();
    }

    public EnvironmentDtos.EnvironmentDto getEnvironment(String appId, String envId) {
        Environment env = findByIdAndAppId(appId, envId);
        return toDto(env, true);
    }

    @Transactional
    public EnvironmentDtos.EnvironmentDto createEnvironment(
            String appId, EnvironmentDtos.CreateEnvironmentRequest request, String userId) {
        validateAppExists(appId);
        String upperName = request.getName().trim().toUpperCase();
        if (environmentRepository.existsByAppIdAndName(appId, upperName)) {
            throw new DuplicateResourceException("Environment", "name", upperName);
        }
        validateVariables(request.getVariables());

        Environment env = new Environment();
        env.setAppId(appId);
        env.setName(upperName);
        env.setDescription(request.getDescription());
        env.setVariables(serializeVariables(request.getVariables()));
        env.setDbConnections(serializeDatabases(request.getDatabases()));
        env.setCertificates(serializeCertificates(request.getCertificates()));
        env.setCreatedBy(userId);
        env.setSslClientCert(request.getSslClientCert());
        env.setSslClientCertPassword(request.getSslClientCertPassword());
        env.setSslTrustAll(request.isSslTrustAll());

        Environment saved = environmentRepository.save(env);
        auditService.logCreate("Environment", saved.getId(), userId, toDto(saved, false));
        return toDto(saved, true);
    }

    @Transactional
    public EnvironmentDtos.EnvironmentDto updateEnvironment(
            String appId, String envId, EnvironmentDtos.UpdateEnvironmentRequest request, String userId) {
        Environment env = findByIdAndAppId(appId, envId);
        EnvironmentDtos.EnvironmentDto previous = toDto(env, false);

        String upperName = request.getName().trim().toUpperCase();
        if (!env.getName().equals(upperName) &&
                environmentRepository.existsByAppIdAndName(appId, upperName)) {
            throw new DuplicateResourceException("Environment", "name", upperName);
        }
        validateVariables(request.getVariables());

        env.setName(upperName);
        env.setDescription(request.getDescription());
        if (request.getVariables() != null) {
            env.setVariables(serializeVariables(request.getVariables()));
        }
        if (request.getDatabases() != null) {
            env.setDbConnections(serializeDatabases(request.getDatabases()));
        }
        if (request.getCertificates() != null) {
            env.setCertificates(serializeCertificates(request.getCertificates()));
        }
        if (request.getIsActive() != null) env.setActive(request.getIsActive());
        if (request.getSslClientCert() != null) env.setSslClientCert(request.getSslClientCert());
        if (request.getSslClientCertPassword() != null) env.setSslClientCertPassword(request.getSslClientCertPassword());
        if (request.getSslTrustAll() != null) env.setSslTrustAll(request.getSslTrustAll());

        Environment saved = environmentRepository.save(env);
        auditService.logUpdate("Environment", envId, userId, previous, toDto(saved, false));
        return toDto(saved, true);
    }

    @Transactional
    public void deleteEnvironment(String appId, String envId, String userId) {
        Environment env = findByIdAndAppId(appId, envId);
        auditService.logDelete("Environment", envId, userId, toDto(env, false));
        environmentRepository.delete(env);
    }

    @Transactional
    public EnvironmentDtos.EnvironmentDto cloneEnvironment(String appId, String envId, String userId) {
        Environment source = findByIdAndAppId(appId, envId);
        String baseCloneName = source.getName() + "_COPY";
        String cloneName = baseCloneName;
        int counter = 1;
        while (environmentRepository.existsByAppIdAndName(appId, cloneName)) {
            cloneName = baseCloneName + "_" + ++counter;
        }

        Environment clone = new Environment();
        clone.setAppId(appId);
        clone.setName(cloneName);
        clone.setDescription(source.getDescription());
        clone.setVariables(source.getVariables());
        clone.setDbConnections(source.getDbConnections());
        clone.setCertificates(source.getCertificates());
        clone.setCreatedBy(userId);
        clone.setSslClientCert(source.getSslClientCert());
        clone.setSslClientCertPassword(source.getSslClientCertPassword());
        clone.setSslTrustAll(source.isSslTrustAll());

        return toDto(environmentRepository.save(clone), true);
    }

    private void validateVariables(List<EnvironmentDtos.EnvironmentVariable> variables) {
        if (variables == null) return;
        Set<String> keys = new HashSet<>();
        for (EnvironmentDtos.EnvironmentVariable v : variables) {
            if (v.getKey() == null || v.getKey().trim().isEmpty()) {
                throw new IllegalArgumentException("Variable key cannot be empty");
            }
            if (v.getValue() == null || v.getValue().trim().isEmpty()) {
                throw new IllegalArgumentException("Variable value cannot be empty");
            }
            // Must contain only alphanumeric and underscore, no spaces or dots
            if (!v.getKey().matches("^[A-Za-z0-9_]+$")) {
                throw new IllegalArgumentException("Variable key must contain only alphanumeric characters and underscores: " + v.getKey());
            }
            if (!keys.add(v.getKey())) {
                throw new IllegalArgumentException("Duplicate variable key: " + v.getKey());
            }
        }
    }

    /**
     * Returns resolved variable map (secrets unmasked) for use by the execution engine.
     * Global configs are merged with app-level variables; app-level overrides on conflict.
     */
    public Map<String, String> getResolvedVariableContext(String envId) {
        Environment env = environmentRepository.findById(envId)
                .orElseThrow(() -> new ResourceNotFoundException("Environment", envId));

        // Load global configs first
        Map<String, String> context = new LinkedHashMap<>();
        globalEnvConfigRepository.findAll().forEach(cfg ->
                context.put(cfg.getConfigKey(), cfg.getConfigValue()));

        // App-level variables override globals
        List<EnvironmentDtos.EnvironmentVariable> vars = deserializeVariables(env.getVariables());
        vars.forEach(v -> context.put(v.getKey(), v.getValue() != null ? v.getValue() : ""));

        return context;
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private void validateAppExists(String appId) {
        if (!applicationRepository.existsById(appId)) {
            throw new ResourceNotFoundException("Application", appId);
        }
    }

    private Environment findByIdAndAppId(String appId, String envId) {
        Environment env = environmentRepository.findById(envId)
                .orElseThrow(() -> new ResourceNotFoundException("Environment", envId));
        if (!env.getAppId().equals(appId)) {
            throw new ResourceNotFoundException("Environment", envId);
        }
        return env;
    }

    private String serializeVariables(List<EnvironmentDtos.EnvironmentVariable> variables) {
        if (variables == null) return "[]";
        return VariableInterpolator.toJson(variables);
    }

    private List<EnvironmentDtos.EnvironmentVariable> deserializeVariables(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse environment variables JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String serializeDatabases(List<EnvironmentDtos.DatabaseConnection> databases) {
        if (databases == null) return "[]";
        return VariableInterpolator.toJson(databases);
    }

    private List<EnvironmentDtos.DatabaseConnection> deserializeDatabases(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse database connections JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String serializeCertificates(List<EnvironmentDtos.CertificateDto> certs) {
        if (certs == null) return "[]";
        return VariableInterpolator.toJson(certs);
    }

    private List<EnvironmentDtos.CertificateDto> deserializeCertificates(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse certificates JSON: {}", e.getMessage());
            return List.of();
        }
    }

    EnvironmentDtos.EnvironmentDto toDto(Environment env, boolean maskSecrets) {
        EnvironmentDtos.EnvironmentDto dto = new EnvironmentDtos.EnvironmentDto();
        dto.setId(env.getId());
        dto.setAppId(env.getAppId());
        dto.setName(env.getName());
        dto.setDescription(env.getDescription());
        dto.setActive(env.isActive());
        dto.setCreatedBy(env.getCreatedBy());
        dto.setCreatedAt(env.getCreatedAt());
        dto.setUpdatedAt(env.getUpdatedAt());
        dto.setSslClientCert(env.getSslClientCert());
        dto.setSslClientCertPassword(env.getSslClientCertPassword());
        dto.setSslTrustAll(env.isSslTrustAll());
        dto.setDatabases(deserializeDatabases(env.getDbConnections()));
        dto.setCertificates(deserializeCertificates(env.getCertificates()));

        List<EnvironmentDtos.EnvironmentVariable> vars = deserializeVariables(env.getVariables());
        dto.setVariables(vars.stream().map(v -> {
            EnvironmentDtos.EnvironmentVariableView view = new EnvironmentDtos.EnvironmentVariableView();
            view.setKey(v.getKey());
            view.setValue(maskSecrets && v.isSecret() ? "***" : v.getValue());
            view.setSecret(v.isSecret());
            view.setDescription(v.getDescription());
            return view;
        }).toList());
        return dto;
    }
}
