package com.axon.orion.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.SecureRandom;

/**
 * OrionSslContextFactory provides a pre-built {@link SSLContext} backed by
 * the bundled Orion keystore and truststore (from {@code resources/security/}).
 *
 * <p>All outbound HTTPS executors (HTTP, SOAP, GraphQL) inject this bean and
 * use it as their default SSL context.
 *
 * <p>To replace certificates in production, either:
 * <ul>
 *   <li>Drop new {@code orion-keystore.jks} / {@code orion-truststore.jks} files
 *       into {@code src/main/resources/security/} and rebuild, or</li>
 *   <li>Set env vars {@code SSL_KEY_STORE}, {@code SSL_TRUST_STORE},
 *       {@code SSL_KEY_STORE_PASSWORD}, {@code SSL_TRUST_STORE_PASSWORD}
 *       pointing to external file paths (use {@code file:/path/to/file}).</li>
 * </ul>
 */
@Slf4j
@Component
public class OrionSslContextFactory {

    @Value("${orion.ssl.key-store}")
    private Resource keyStoreResource;

    @Value("${orion.ssl.key-store-password}")
    private String keyStorePassword;

    @Value("${orion.ssl.key-store-type:JKS}")
    private String keyStoreType;

    @Value("${orion.ssl.trust-store}")
    private Resource trustStoreResource;

    @Value("${orion.ssl.trust-store-password}")
    private String trustStorePassword;

    @Value("${orion.ssl.trust-store-type:JKS}")
    private String trustStoreType;

    private volatile SSLContext cachedContext;

    /**
     * Returns the Orion default {@link SSLContext} backed by the bundled
     * keystore and truststore. The context is lazily initialised and cached
     * for the lifetime of the application.
     *
     * @return a configured {@link SSLContext}, or the JVM default if
     *         initialisation fails
     */
    public SSLContext getOrionSslContext() {
        if (cachedContext == null) {
            synchronized (this) {
                if (cachedContext == null) {
                    cachedContext = buildSslContext();
                }
            }
        }
        return cachedContext;
    }

    private SSLContext buildSslContext() {
        try {
            // ---- Keystore (client identity / outbound mutual TLS) ----
            KeyStore keyStore = KeyStore.getInstance(keyStoreType);
            try (InputStream ks = keyStoreResource.getInputStream()) {
                keyStore.load(ks, keyStorePassword.toCharArray());
            }
            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(keyStore, keyStorePassword.toCharArray());

            // ---- Truststore (server cert validation for outbound calls) ----
            KeyStore trustStore = KeyStore.getInstance(trustStoreType);
            try (InputStream ts = trustStoreResource.getInputStream()) {
                trustStore.load(ts, trustStorePassword.toCharArray());
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);

            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(), new SecureRandom());

            log.info("OrionSslContextFactory initialised -- keyStore: {}, trustStore: {}",
                    keyStoreResource.getDescription(), trustStoreResource.getDescription());
            return ctx;
        } catch (Exception e) {
            log.error("Failed to initialise Orion SSLContext from bundled keystores: {}. " +
                    "Falling back to JVM default trust.", e.getMessage(), e);
            try {
                return SSLContext.getDefault();
            } catch (Exception ex) {
                log.error("Could not obtain JVM default SSLContext either: {}", ex.getMessage());
                return null;
            }
        }
    }
}