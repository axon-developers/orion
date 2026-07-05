package com.axon.orion.environment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class EnvironmentCertificate {

    @Column(name = "id")
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "client_cert", columnDefinition = "TEXT")
    private String clientCert;

    @Column(name = "client_cert_password")
    private String clientCertPassword;
}
