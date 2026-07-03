package com.axon.orion.global_config.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "global_env_configs")
@Getter
@Setter
public class GlobalEnvConfig extends BaseEntity {

    @Column(name = "config_key", nullable = false, unique = true)
    private String configKey;

    @Column(name = "config_value", nullable = false, columnDefinition = "TEXT")
    private String configValue;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_secret", nullable = false)
    private boolean isSecret = false;

    @Column(name = "created_by", nullable = false)
    private String createdBy;
}
