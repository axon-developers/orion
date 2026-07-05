package com.axon.orion.environment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class EnvironmentDatabase {

    @Column(name = "id")
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "type")
    private String type;

    @Column(name = "host")
    private String host;

    @Column(name = "port")
    private Integer port;

    @Column(name = "database_name")
    private String databaseName;

    @Column(name = "username")
    private String username;

    @Column(name = "password")
    private String password;

    @Column(name = "certificate_key")
    private String certificateKey;

    @Column(name = "connection_url", columnDefinition = "TEXT")
    private String connectionUrl;

    @Column(name = "cert_placeholder")
    private String certPlaceholder;
}
