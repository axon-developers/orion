package com.axon.orion.environment.service;

import com.axon.orion.application.repository.ApplicationRepository;
import com.axon.orion.audit.service.AuditService;
import com.axon.orion.common.exception.DuplicateResourceException;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.service.EncryptionService;
import com.axon.orion.common.util.VariableInterpolator;
import com.axon.orion.environment.dto.EnvironmentDtos;
import com.axon.orion.environment.entity.Environment;
import com.axon.orion.environment.entity.EnvironmentVariable;
import com.axon.orion.environment.entity.EnvironmentDatabase;
import com.axon.orion.environment.entity.EnvironmentCertificate;
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
    private final EncryptionService encryptionService;

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
        env.setVariables(mapVariables(request.getVariables(), null));
        env.setDbConnections(mapDatabases(request.getDatabases(), null));
        env.setCertificates(mapCertificates(request.getCertificates(), null));
        env.setCreatedBy(userId);
        env.setSslClientCert(request.getSslClientCert());
        env.setSslClientCertPassword(encryptionService.encrypt(request.getSslClientCertPassword()));
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
            env.setVariables(mapVariables(request.getVariables(), env.getVariables()));
        }
        if (request.getDatabases() != null) {
            env.setDbConnections(mapDatabases(request.getDatabases(), env.getDbConnections()));
        }
        if (request.getCertificates() != null) {
            env.setCertificates(mapCertificates(request.getCertificates(), env.getCertificates()));
        }
        if (request.getIsActive() != null) env.setActive(request.getIsActive());
        if (request.getSslClientCert() != null) env.setSslClientCert(request.getSslClientCert());
        if (request.getSslClientCertPassword() != null) {
            if ("***".equals(request.getSslClientCertPassword())) {
                // Keep existing cert password
            } else {
                env.setSslClientCertPassword(encryptionService.encrypt(request.getSslClientCertPassword()));
            }
        }
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
        clone.setVariables(source.getVariables().stream().map(v -> {
            EnvironmentVariable ev = new EnvironmentVariable();
            ev.setKey(v.getKey());
            ev.setValue(v.getValue());
            ev.setSecret(v.isSecret());
            ev.setDescription(v.getDescription());
            return ev;
        }).collect(Collectors.toCollection(ArrayList::new)));
        clone.setDbConnections(source.getDbConnections().stream().map(d -> {
            EnvironmentDatabase ed = new EnvironmentDatabase();
            ed.setId(UUID.randomUUID().toString());
            ed.setName(d.getName());
            ed.setType(d.getType());
            ed.setHost(d.getHost());
            ed.setPort(d.getPort());
            ed.setDatabaseName(d.getDatabaseName());
            ed.setUsername(d.getUsername());
            ed.setPassword(d.getPassword());
            ed.setCertificateKey(d.getCertificateKey());
            ed.setConnectionUrl(d.getConnectionUrl());
            ed.setCertPlaceholder(d.getCertPlaceholder());
            return ed;
        }).collect(Collectors.toCollection(ArrayList::new)));
        clone.setCertificates(source.getCertificates().stream().map(c -> {
            EnvironmentCertificate ec = new EnvironmentCertificate();
            ec.setId(UUID.randomUUID().toString());
            ec.setName(c.getName());
            ec.setDescription(c.getDescription());
            ec.setClientCert(c.getClientCert());
            ec.setClientCertPassword(c.getClientCertPassword());
            return ec;
        }).collect(Collectors.toCollection(ArrayList::new)));
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
        env.getVariables().forEach(v -> context.put(v.getKey(), v.getValue() != null ? v.getValue() : ""));

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

    private List<EnvironmentVariable> mapVariables(List<EnvironmentDtos.EnvironmentVariable> dtos, List<EnvironmentVariable> existingVars) {
        if (dtos == null) return new ArrayList<>();
        Map<String, String> existingMap = existingVars == null ? Map.of() :
            existingVars.stream()
                .filter(v -> v.getKey() != null && v.getValue() != null)
                .collect(Collectors.toMap(EnvironmentVariable::getKey, EnvironmentVariable::getValue, (a, b) -> a));

        return dtos.stream().map(d -> {
            EnvironmentVariable ev = new EnvironmentVariable();
            ev.setKey(d.getKey());
            ev.setSecret(d.isSecret());
            ev.setDescription(d.getDescription());
            if (d.isSecret() && "***".equals(d.getValue()) && existingMap.containsKey(d.getKey())) {
                ev.setValue(existingMap.get(d.getKey()));
            } else {
                ev.setValue(d.getValue());
            }
            return ev;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    private List<EnvironmentDatabase> mapDatabases(List<EnvironmentDtos.DatabaseConnection> dtos, List<EnvironmentDatabase> existingDbs) {
        if (dtos == null) return new ArrayList<>();
        Map<String, String> existingMap = existingDbs == null ? Map.of() :
            existingDbs.stream()
                .filter(db -> db.getId() != null && db.getPassword() != null)
                .collect(Collectors.toMap(EnvironmentDatabase::getId, EnvironmentDatabase::getPassword, (a, b) -> a));

        return dtos.stream().map(d -> {
            EnvironmentDatabase ed = new EnvironmentDatabase();
            ed.setId(d.getId() != null && !d.getId().isBlank() ? d.getId() : UUID.randomUUID().toString());
            ed.setName(d.getName());
            ed.setType(d.getType());
            ed.setHost(d.getHost());
            ed.setPort(d.getPort());
            ed.setDatabaseName(d.getDatabaseName());
            ed.setUsername(d.getUsername());
            
            if ("***".equals(d.getPassword()) && existingMap.containsKey(ed.getId())) {
                ed.setPassword(existingMap.get(ed.getId()));
            } else {
                ed.setPassword(encryptionService.encrypt(d.getPassword()));
            }
            
            ed.setCertificateKey(d.getCertificateKey());
            ed.setConnectionUrl(d.getConnectionUrl());
            ed.setCertPlaceholder(d.getCertPlaceholder());
            return ed;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    private List<EnvironmentCertificate> mapCertificates(List<EnvironmentDtos.CertificateDto> dtos, List<EnvironmentCertificate> existingCerts) {
        if (dtos == null) return new ArrayList<>();
        Map<String, String> existingMap = existingCerts == null ? Map.of() :
            existingCerts.stream()
                .filter(c -> c.getId() != null && c.getClientCertPassword() != null)
                .collect(Collectors.toMap(EnvironmentCertificate::getId, EnvironmentCertificate::getClientCertPassword, (a, b) -> a));

        return dtos.stream().map(d -> {
            EnvironmentCertificate ec = new EnvironmentCertificate();
            ec.setId(d.getId() != null && !d.getId().isBlank() ? d.getId() : UUID.randomUUID().toString());
            ec.setName(d.getName());
            ec.setDescription(d.getDescription());
            ec.setClientCert(d.getClientCert());
            
            if ("***".equals(d.getClientCertPassword()) && existingMap.containsKey(ec.getId())) {
                ec.setClientCertPassword(existingMap.get(ec.getId()));
            } else {
                ec.setClientCertPassword(encryptionService.encrypt(d.getClientCertPassword()));
            }
            return ec;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    EnvironmentDtos.EnvironmentDto toDto(Environment env, boolean maskSecrets) {
        EnvironmentDtos.EnvironmentDto dto = new EnvironmentDtos.EnvironmentDto();
        dto.setId(env.getId());
        dto.setAppId(env.getAppId());
        dto.setName(env.getName());
        dto.setDescription(env.getDescription());
        dto.setActive(env.isActive());
        dto.setCreatedBy(env.getCreatedBy());
        dto.setCreatedAt(env.getCreatedAt() != null ? env.getCreatedAt().toString() : null);
        dto.setUpdatedAt(env.getUpdatedAt() != null ? env.getUpdatedAt().toString() : null);
        dto.setSslClientCert(env.getSslClientCert());
        dto.setSslClientCertPassword(maskSecrets && env.getSslClientCertPassword() != null ? "***" : encryptionService.decrypt(env.getSslClientCertPassword()));
        dto.setSslTrustAll(env.isSslTrustAll());
        
        dto.setDatabases(env.getDbConnections().stream().map(db -> {
            EnvironmentDtos.DatabaseConnection d = new EnvironmentDtos.DatabaseConnection();
            d.setId(db.getId());
            d.setName(db.getName());
            d.setType(db.getType());
            d.setHost(db.getHost());
            d.setPort(db.getPort());
            d.setDatabaseName(db.getDatabaseName());
            d.setUsername(db.getUsername());
            d.setPassword(maskSecrets && db.getPassword() != null ? "***" : encryptionService.decrypt(db.getPassword()));
            d.setCertificateKey(db.getCertificateKey());
            d.setConnectionUrl(db.getConnectionUrl());
            d.setCertPlaceholder(db.getCertPlaceholder());
            return d;
        }).toList());

        dto.setCertificates(env.getCertificates().stream().map(c -> {
            EnvironmentDtos.CertificateDto cd = new EnvironmentDtos.CertificateDto();
            cd.setId(c.getId());
            cd.setName(c.getName());
            cd.setDescription(c.getDescription());
            cd.setClientCert(c.getClientCert());
            cd.setClientCertPassword(maskSecrets && c.getClientCertPassword() != null ? "***" : encryptionService.decrypt(c.getClientCertPassword()));
            return cd;
        }).toList());

        dto.setVariables(env.getVariables().stream().map(v -> {
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
