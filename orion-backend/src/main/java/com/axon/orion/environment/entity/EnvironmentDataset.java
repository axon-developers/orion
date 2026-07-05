package com.axon.orion.environment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class EnvironmentDataset {

    @Column(name = "id")
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "filename", nullable = false)
    private String filename;

    @Column(name = "csv_content", columnDefinition = "TEXT", nullable = false)
    private String csvContent;
}
