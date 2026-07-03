package com.axon.orion.global_config.service;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.DuplicateResourceException;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.global_config.dto.GlobalEnvConfigDtos;
import com.axon.orion.global_config.entity.GlobalEnvConfig;
import com.axon.orion.global_config.repository.GlobalEnvConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GlobalEnvConfigService {

    private final GlobalEnvConfigRepository repository;

    public PagedResponse<GlobalEnvConfigDtos.GlobalEnvConfigDto> listConfigs(
            int page, int size, String search) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("configKey").ascending());
        Page<GlobalEnvConfig> result = repository.findAllWithSearch(search, pageRequest);
        List<GlobalEnvConfigDtos.GlobalEnvConfigDto> dtos = result.getContent().stream()
                .map(c -> GlobalEnvConfigDtos.toDto(c, true)).toList();
        return PagedResponse.of(dtos, page, size, result.getTotalElements());
    }

    public GlobalEnvConfigDtos.GlobalEnvConfigDto getConfig(String id) {
        return GlobalEnvConfigDtos.toDto(findById(id), true);
    }

    @Transactional
    public GlobalEnvConfigDtos.GlobalEnvConfigDto createConfig(
            GlobalEnvConfigDtos.CreateGlobalEnvConfigRequest request, String userId) {
        if (repository.existsByConfigKey(request.getConfigKey())) {
            throw new DuplicateResourceException("GlobalEnvConfig", "configKey", request.getConfigKey());
        }
        GlobalEnvConfig config = new GlobalEnvConfig();
        config.setConfigKey(request.getConfigKey());
        config.setConfigValue(request.getConfigValue());
        config.setDescription(request.getDescription());
        config.setSecret(request.isSecret());
        config.setCreatedBy(userId);
        return GlobalEnvConfigDtos.toDto(repository.save(config), true);
    }

    @Transactional
    public GlobalEnvConfigDtos.GlobalEnvConfigDto updateConfig(
            String id, GlobalEnvConfigDtos.UpdateGlobalEnvConfigRequest request) {
        GlobalEnvConfig config = findById(id);
        config.setConfigValue(request.getConfigValue());
        if (request.getDescription() != null) config.setDescription(request.getDescription());
        if (request.getIsSecret() != null) config.setSecret(request.getIsSecret());
        return GlobalEnvConfigDtos.toDto(repository.save(config), true);
    }

    @Transactional
    public void deleteConfig(String id) {
        GlobalEnvConfig config = findById(id);
        repository.delete(config);
    }

    private GlobalEnvConfig findById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GlobalEnvConfig", id));
    }
}
