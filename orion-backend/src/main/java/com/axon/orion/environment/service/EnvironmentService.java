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
import com.axon.orion.environment.entity.EnvironmentDataset;
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
        env.setSecrets(mapSecrets(request.getSecrets(), null));
        env.setDbConnections(mapDatabases(request.getDatabases(), null));
        env.setCertificates(mapCertificates(request.getCertificates(), null));
        env.setDatasets(mapDatasets(request.getDatasets(), null));
        env.setCreatedBy(userId);
        env.setSslClientCert(request.getSslClientCert());
        env.setSslClientCertPassword(encryptionService.encrypt(request.getSslClientCertPassword()));
        env.setSslTrustAll(request.isSslTrustAll());
        
        boolean isFirst = environmentRepository.countByAppId(appId) == 0;
        env.setDefault(isFirst);

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
        if (request.getSecrets() != null) {
            env.setSecrets(mapSecrets(request.getSecrets(), env.getSecrets()));
        }
        if (request.getDatabases() != null) {
            env.setDbConnections(mapDatabases(request.getDatabases(), env.getDbConnections()));
        }
        if (request.getCertificates() != null) {
            env.setCertificates(mapCertificates(request.getCertificates(), env.getCertificates()));
        }
        if (request.getDatasets() != null) {
            env.setDatasets(mapDatasets(request.getDatasets(), env.getDatasets()));
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
        clone.setDatasets(source.getDatasets().stream().map(d -> {
            EnvironmentDataset ed = new EnvironmentDataset();
            ed.setId(UUID.randomUUID().toString());
            ed.setName(d.getName());
            ed.setFilename(d.getFilename());
            ed.setCsvContent(d.getCsvContent());
            return ed;
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

    private List<EnvironmentDataset> mapDatasets(List<EnvironmentDtos.DatasetDto> dtos, List<EnvironmentDataset> existingDatasets) {
        if (dtos == null) return new ArrayList<>();
        return dtos.stream().map(d -> {
            EnvironmentDataset ed = new EnvironmentDataset();
            ed.setId(d.getId() != null && !d.getId().isBlank() ? d.getId() : UUID.randomUUID().toString());
            ed.setName(d.getName());
            ed.setFilename(d.getFilename());
            ed.setCsvContent(d.getCsvContent());
            return ed;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    EnvironmentDtos.EnvironmentDto toDto(Environment env, boolean maskSecrets) {
        EnvironmentDtos.EnvironmentDto dto = new EnvironmentDtos.EnvironmentDto();
        dto.setId(env.getId());
        dto.setAppId(env.getAppId());
        dto.setName(env.getName());
        dto.setDescription(env.getDescription());
        dto.setActive(env.isActive());
        dto.setDefault(env.isDefault());
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

        dto.setSecrets(env.getSecrets().stream().map(s -> {
            EnvironmentDtos.EnvironmentSecretDto sd = new EnvironmentDtos.EnvironmentSecretDto();
            sd.setKey(s.getKey());
            sd.setValue(maskSecrets ? "••••••••" : encryptionService.decrypt(s.getEncryptedValue()));
            sd.setDescription(s.getDescription());
            return sd;
        }).toList());

        dto.setDatasets(env.getDatasets().stream().map(d -> {
            EnvironmentDtos.DatasetDto dd = new EnvironmentDtos.DatasetDto();
            dd.setId(d.getId());
            dd.setName(d.getName());
            dd.setFilename(d.getFilename());
            dd.setCsvContent(d.getCsvContent());
            return dd;
        }).toList());
        return dto;
    }

    @Transactional
    public EnvironmentDtos.EnvironmentDto setDefaultEnvironment(String appId, String envId, String userId) {
        // Verify environment exists for app
        Environment targetEnv = findByIdAndAppId(appId, envId);
        
        List<Environment> environments = environmentRepository.findByAppIdOrderByCreatedAtAsc(appId);
        for (Environment env : environments) {
            env.setDefault(env.getId().equals(envId));
        }
        environmentRepository.saveAll(environments);
        
        auditService.logUpdate("Environment", envId, userId, "Set as Default", envId);
        return toDto(targetEnv, true);
    }

    public EnvironmentDtos.DbValidationResponse validateDatabaseConnection(EnvironmentDtos.DbValidationRequest request) {
        EnvironmentDtos.DbValidationResponse response = new EnvironmentDtos.DbValidationResponse();
        
        String connectionString = request.getConnectionUrl();
        String type = (request.getType() != null ? request.getType() : "SQLITE").toUpperCase();
        String host = request.getHost();
        Integer portNum = request.getPort();
        String port = portNum != null ? String.valueOf(portNum) : "";
        String databaseName = request.getDatabaseName();
        String username = request.getUsername();
        String password = request.getPassword();

        // 1. Resolve masked password if needed
        if ("***".equals(password) && request.getEnvId() != null && !request.getEnvId().isBlank() && request.getDatabaseId() != null && !request.getDatabaseId().isBlank()) {
            Optional<Environment> envOpt = environmentRepository.findById(request.getEnvId());
            if (envOpt.isPresent()) {
                EnvironmentDatabase targetDb = envOpt.get().getDbConnections().stream()
                        .filter(db -> request.getDatabaseId().equals(db.getId()) || request.getDatabaseId().equals(db.getName()))
                        .findFirst()
                        .orElse(null);
                if (targetDb != null && targetDb.getPassword() != null) {
                    password = encryptionService.decrypt(targetDb.getPassword());
                }
            }
        }

        // 2. Build connection string if not custom connection URL
        if (connectionString == null || connectionString.isBlank()) {
            if ("POSTGRESQL".equals(type) || "COCKROACHDB".equals(type)) {
                connectionString = String.format("jdbc:postgresql://%s:%s/%s", host, port, databaseName);
            } else if ("MYSQL".equals(type)) {
                connectionString = String.format("jdbc:mysql://%s:%s/%s", host, port, databaseName);
            } else if ("ORACLE".equals(type)) {
                connectionString = String.format("jdbc:oracle:thin:@//%s:%s/%s", host, port, databaseName);
            } else if ("DB2".equals(type)) {
                connectionString = String.format("jdbc:db2://%s:%s/%s", host, port, databaseName);
            } else if ("SQLITE".equals(type)) {
                connectionString = String.format("jdbc:sqlite:%s?busy_timeout=5000", databaseName);
            } else {
                response.setSuccess(false);
                response.setMessage("Unsupported database type: " + type);
                return response;
            }
        } else {
            connectionString = com.axon.orion.common.util.DbUrlHelper.normalize(connectionString);
        }

        // 3. Attempt Connection & Close immediately
        log.info("Testing connection to: {}", connectionString);
        try (java.sql.Connection conn = createJdbcConnection(connectionString, username, password, type)) {
            if (conn != null && !conn.isClosed()) {
                response.setSuccess(true);
                response.setMessage("Database Connection Validated Successfully!");
            } else {
                response.setSuccess(false);
                response.setMessage("Failed to open connection. Connection was closed immediately.");
            }
        } catch (Exception e) {
            log.error("Database connection validation failed: {}", e.getMessage());
            response.setSuccess(false);
            response.setMessage("Database Connection Failed: " + e.getMessage());
        }

        return response;
    }

    private java.sql.Connection createJdbcConnection(String connectionString, String username, String password, String type) throws Exception {
        if ("SQLITE".equalsIgnoreCase(type)) {
            return java.sql.DriverManager.getConnection(connectionString);
        }
        if (username != null && !username.isBlank()) {
            return java.sql.DriverManager.getConnection(connectionString, username, password);
        }
        return java.sql.DriverManager.getConnection(connectionString);
    }

    private List<com.axon.orion.environment.entity.EnvironmentSecret> mapSecrets(List<EnvironmentDtos.EnvironmentSecretDto> dtos, List<com.axon.orion.environment.entity.EnvironmentSecret> existingSecrets) {
        if (dtos == null) return new ArrayList<>();
        Map<String, String> existingMap = existingSecrets == null ? Map.of() :
            existingSecrets.stream()
                .filter(s -> s.getKey() != null && s.getEncryptedValue() != null)
                .collect(Collectors.toMap(com.axon.orion.environment.entity.EnvironmentSecret::getKey, com.axon.orion.environment.entity.EnvironmentSecret::getEncryptedValue, (a, b) -> a));

        return dtos.stream().map(d -> {
            com.axon.orion.environment.entity.EnvironmentSecret es = new com.axon.orion.environment.entity.EnvironmentSecret();
            es.setKey(d.getKey());
            es.setDescription(d.getDescription());
            if ("••••••••".equals(d.getValue()) || "***".equals(d.getValue())) {
                es.setEncryptedValue(existingMap.getOrDefault(d.getKey(), ""));
            } else {
                es.setEncryptedValue(encryptionService.encrypt(d.getValue()));
            }
            return es;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    public EnvironmentDtos.EnvironmentDiffDto compareEnvironments(String appId, String sourceId, String targetId) {
        Environment source = findByIdAndAppId(appId, sourceId);
        Environment target = findByIdAndAppId(appId, targetId);

        Map<String, String> sourceVars = source.getVariables().stream()
                .collect(Collectors.toMap(EnvironmentVariable::getKey, v -> v.getValue() != null ? v.getValue() : "", (a, b) -> a));
        Map<String, String> targetVars = target.getVariables().stream()
                .collect(Collectors.toMap(EnvironmentVariable::getKey, v -> v.getValue() != null ? v.getValue() : "", (a, b) -> a));

        List<EnvironmentDtos.EnvironmentVariable> missingInTarget = new ArrayList<>();
        List<EnvironmentDtos.EnvironmentVariable> missingInSource = new ArrayList<>();
        List<String> mismatched = new ArrayList<>();

        for (EnvironmentVariable sv : source.getVariables()) {
            if (!targetVars.containsKey(sv.getKey())) {
                EnvironmentDtos.EnvironmentVariable ev = new EnvironmentDtos.EnvironmentVariable();
                ev.setKey(sv.getKey());
                ev.setValue(sv.getValue());
                ev.setSecret(sv.isSecret());
                ev.setDescription(sv.getDescription());
                missingInTarget.add(ev);
            } else if (!Objects.equals(sv.getValue(), targetVars.get(sv.getKey()))) {
                mismatched.add(sv.getKey());
            }
        }

        for (EnvironmentVariable tv : target.getVariables()) {
            if (!sourceVars.containsKey(tv.getKey())) {
                EnvironmentDtos.EnvironmentVariable ev = new EnvironmentDtos.EnvironmentVariable();
                ev.setKey(tv.getKey());
                ev.setValue(tv.getValue());
                ev.setSecret(tv.isSecret());
                ev.setDescription(tv.getDescription());
                missingInSource.add(ev);
            }
        }

        EnvironmentDtos.EnvironmentDiffDto diff = new EnvironmentDtos.EnvironmentDiffDto();
        diff.setSourceEnvId(source.getId());
        diff.setSourceEnvName(source.getName());
        diff.setTargetEnvId(target.getId());
        diff.setTargetEnvName(target.getName());
        diff.setMissingKeysInTarget(missingInTarget);
        diff.setMissingKeysInSource(missingInSource);
        diff.setMismatchedValueKeys(mismatched);
        return diff;
    }

    @Transactional
    public EnvironmentDtos.EnvironmentDto syncMissingKeys(String appId, String sourceId, String targetId) {
        Environment source = findByIdAndAppId(appId, sourceId);
        Environment target = findByIdAndAppId(appId, targetId);

        Set<String> targetKeys = target.getVariables().stream()
                .map(EnvironmentVariable::getKey)
                .collect(Collectors.toSet());

        for (EnvironmentVariable sv : source.getVariables()) {
            if (!targetKeys.contains(sv.getKey())) {
                EnvironmentVariable newVar = new EnvironmentVariable();
                newVar.setKey(sv.getKey());
                newVar.setValue(sv.getValue());
                newVar.setSecret(sv.isSecret());
                newVar.setDescription(sv.getDescription());
                target.getVariables().add(newVar);
            }
        }

        Environment saved = environmentRepository.save(target);
        return toDto(saved, true);
    }
}
