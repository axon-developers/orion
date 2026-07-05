package com.axon.orion.common.entity;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;

public class InstantAttributeConverterTest {

    private final InstantAttributeConverter converter = new InstantAttributeConverter();

    @Test
    public void testConvertToDatabaseColumn() {
        Instant instant = Instant.parse("2026-07-03T21:10:16Z");
        String dbColumn = converter.convertToDatabaseColumn(instant);
        assertThat(dbColumn).isEqualTo("2026-07-03T21:10:16Z");
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
    }

    @Test
    public void testConvertToEntityAttributeWithSpace() {
        String dbData = "2026-07-03 21:10:16";
        Instant instant = converter.convertToEntityAttribute(dbData);
        assertThat(instant).isEqualTo(Instant.parse("2026-07-03T21:10:16Z"));
    }

    @Test
    public void testConvertToEntityAttributeWithIsoZ() {
        String dbData = "2026-07-03T21:10:16Z";
        Instant instant = converter.convertToEntityAttribute(dbData);
        assertThat(instant).isEqualTo(Instant.parse("2026-07-03T21:10:16Z"));
    }

    @Test
    public void testConvertToEntityAttributeWithSpaceAndOffset() {
        String dbData = "2026-07-03 21:10:16+02:00";
        Instant instant = converter.convertToEntityAttribute(dbData);
        assertThat(instant).isEqualTo(Instant.parse("2026-07-03T19:10:16Z"));
    }

    @Test
    public void testConvertToEntityAttributeNullOrBlank() {
        assertThat(converter.convertToEntityAttribute(null)).isNull();
        assertThat(converter.convertToEntityAttribute("")).isNull();
        assertThat(converter.convertToEntityAttribute("   ")).isNull();
    }
}
