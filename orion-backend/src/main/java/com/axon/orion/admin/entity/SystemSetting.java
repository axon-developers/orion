package com.axon.orion.admin.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "system_settings")
@Getter
@Setter
public class SystemSetting extends BaseEntity {

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "setting_key", nullable = false, unique = true)
    private String settingKey;

    @Column(name = "setting_value", nullable = false, columnDefinition = "TEXT")
    private String settingValue;

    @Column(name = "value_type", nullable = false)
    private String valueType;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "requires_restart", nullable = false)
    private boolean requiresRestart = false;

    @Column(name = "updated_by")
    private String updatedBy;
}
