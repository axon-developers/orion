package com.axon.orion.environment.entity;

import com.axon.orion.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.ArrayList;
import java.util.List;

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

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "environment_variables", joinColumns = @JoinColumn(name = "environment_id"))
    private List<EnvironmentVariable> variables = new ArrayList<>();

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "ssl_client_cert", columnDefinition = "TEXT")
    private String sslClientCert;

    @Column(name = "ssl_client_cert_password")
    private String sslClientCertPassword;

    @Column(name = "ssl_trust_all", nullable = false)
    private boolean sslTrustAll = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "environment_databases", joinColumns = @JoinColumn(name = "environment_id"))
    private List<EnvironmentDatabase> dbConnections = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "environment_certificates", joinColumns = @JoinColumn(name = "environment_id"))
    private List<EnvironmentCertificate> certificates = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "environment_datasets", joinColumns = @JoinColumn(name = "environment_id"))
    private List<EnvironmentDataset> datasets = new ArrayList<>();
}
