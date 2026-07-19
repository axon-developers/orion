package com.axon.orion.common.util;

import lombok.extern.slf4j.Slf4j;

/**
 * Helper class to normalize database connection URLs by ensuring they
 * start with the correct JDBC protocol prefixes.
 */
@Slf4j
public class DbUrlHelper {

    /**
     * Normalizes a raw connection URL to ensure it is a valid JDBC connection URL.
     * Maps postgres://, mysql://, sqlite:// etc. to their jdbc: counterparts.
     *
     * @param url the connection URL to normalize
     * @return the normalized connection URL
     */
    public static String normalize(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }

        String trimmed = url.trim();
        if (trimmed.startsWith("jdbc:")) {
            return trimmed;
        }

        // Map various non-jdbc schemas to valid jdbc strings
        if (trimmed.startsWith("postgres://")) {
            return "jdbc:postgresql://" + trimmed.substring(11);
        }
        if (trimmed.startsWith("postgresql://")) {
            return "jdbc:postgresql://" + trimmed.substring(13);
        }
        if (trimmed.startsWith("mysql://")) {
            return "jdbc:mysql://" + trimmed.substring(8);
        }
        if (trimmed.startsWith("oracle://")) {
            return "jdbc:oracle:thin:@//" + trimmed.substring(9);
        }
        if (trimmed.startsWith("sqlite://")) {
            return "jdbc:sqlite:" + trimmed.substring(9);
        }
        if (trimmed.startsWith("db2://")) {
            return "jdbc:db2://" + trimmed.substring(6);
        }
        if (trimmed.startsWith("sqlserver://")) {
            return "jdbc:sqlserver://" + trimmed.substring(12);
        }

        // Default fallback: prepend jdbc: prefix
        return "jdbc:" + trimmed;
    }
}
