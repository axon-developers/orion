package com.axon.orion.common.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.Instant;

@Converter(autoApply = true)
public class InstantAttributeConverter implements AttributeConverter<Instant, String> {

    @Override
    public String convertToDatabaseColumn(Instant attribute) {
        return attribute == null ? null : attribute.toString();
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            String normalized = dbData.replace(' ', 'T');
            if (normalized.endsWith("Z") || (normalized.length() > 10 && (normalized.substring(10).contains("+") || normalized.substring(10).contains("-")))) {
                return Instant.parse(normalized);
            } else {
                return java.time.LocalDateTime.parse(normalized).toInstant(java.time.ZoneOffset.UTC);
            }
        } catch (Exception e) {
            return Instant.parse(dbData);
        }
    }
}
