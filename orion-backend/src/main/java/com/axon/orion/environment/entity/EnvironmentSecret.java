package com.axon.orion.environment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class EnvironmentSecret {

    @Column(name = "secret_key", nullable = false)
    private String key;

    @Column(name = "secret_value", nullable = false, columnDefinition = "TEXT")
    private String encryptedValue;

    @Column(name = "description")
    private String description;
}
