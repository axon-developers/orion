package com.axon.orion.environment.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "environments",
       uniqueConstraints = @UniqueConstraint(columnNames = {"app_id", "name"}))
@Getter
@Setter
public class Environment extends BaseEntity {

    @Column(name = "app_id", nullable = false)
    private String appId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "variables", nullable = false, columnDefinition = "TEXT")
    private String variables = "[]";

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "ssl_client_cert", columnDefinition = "TEXT")
    private String sslClientCert;

    @Column(name = "ssl_client_cert_password")
    private String sslClientCertPassword;

    @Column(name = "ssl_trust_all", nullable = false)
    private boolean sslTrustAll = false;

    @Column(name = "db_connections", columnDefinition = "TEXT")
    private String dbConnections = "[]";

    @Column(name = "certificates", columnDefinition = "TEXT")
    private String certificates = "[]";
}
