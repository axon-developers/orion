package com.axon.orion.config;

import com.axon.orion.admin.service.SystemSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.net.ssl.KeyManager;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

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

    private final SystemSettingsService systemSettingsService;
    private volatile SSLContext cachedJksContext;
    private volatile SSLContext cachedTrustAllContext;

    public OrionSslContextFactory(@Lazy SystemSettingsService systemSettingsService) {
        this.systemSettingsService = systemSettingsService;
    }

    /**
     * Returns the appropriate {@link SSLContext} dynamically based on the
     * "orion.ssl.skip_verification" configuration toggle.
     *
     * @return a configured {@link SSLContext}
     */
    public SSLContext getOrionSslContext() {
        boolean skipVerification = systemSettingsService.getBoolean("orion.ssl.skip_verification", false);
        if (skipVerification) {
            if (cachedTrustAllContext == null) {
                synchronized (this) {
                    if (cachedTrustAllContext == null) {
                        cachedTrustAllContext = buildTrustAllSslContext();
                    }
                }
            }
            return cachedTrustAllContext;
        } else {
            if (cachedJksContext == null) {
                synchronized (this) {
                    if (cachedJksContext == null) {
                        cachedJksContext = buildJksSslContext();
                    }
                }
            }
            return cachedJksContext;
        }
    }

    private SSLContext buildJksSslContext() {
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

            log.info("OrionSslContextFactory initialized JKS SSLContext -- keyStore: {}, trustStore: {}",
                    keyStoreResource.getDescription(), trustStoreResource.getDescription());
            return ctx;
        } catch (Exception e) {
            log.error("Failed to initialize JKS SSLContext from bundled keystores: {}. Falling back to default trust.", e.getMessage());
            return getDefaultSslContext();
        }
    }

    private SSLContext buildTrustAllSslContext() {
        try {
            // Still load client identity KeyManagers if present to support mTLS if needed
            KeyManager[] keyManagers = null;
            try {
                KeyStore keyStore = KeyStore.getInstance(keyStoreType);
                try (InputStream ks = keyStoreResource.getInputStream()) {
                    keyStore.load(ks, keyStorePassword.toCharArray());
                }
                KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
                kmf.init(keyStore, keyStorePassword.toCharArray());
                keyManagers = kmf.getKeyManagers();
            } catch (Exception e) {
                log.warn("Could not load client identity KeyManagers for trust-all context: {}", e.getMessage());
            }

            // Trust all certificates (ignore verification failures)
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };

            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(keyManagers, trustAllCerts, new SecureRandom());
            log.info("OrionSslContextFactory initialized TRUST-ALL SSLContext (skip SSL validation enabled)");
            return ctx;
        } catch (Exception e) {
            log.error("Failed to initialize TRUST-ALL SSLContext: {}. Falling back to default trust.", e.getMessage());
            return getDefaultSslContext();
        }
    }

    private SSLContext getDefaultSslContext() {
        try {
            return SSLContext.getDefault();
        } catch (Exception ex) {
            log.error("Could not obtain JVM default SSLContext: {}", ex.getMessage());
            return null;
        }
    }
}