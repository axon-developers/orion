package com.axon.orion.environment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class EnvironmentVariable {

    @Column(name = "variable_key", nullable = false)
    private String key;

    @Column(name = "variable_value", columnDefinition = "TEXT")
    private String value;

    @Column(name = "is_secret", nullable = false)
    private boolean isSecret;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
}
