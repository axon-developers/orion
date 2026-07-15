package com.axon.orion.config;

import com.axon.orion.admin.service.SystemSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.server.ConfigurableWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.server.Ssl;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;

@Slf4j
@Component
public class SslWebServerFactoryCustomizer implements WebServerFactoryCustomizer<ConfigurableWebServerFactory> {

    private final SystemSettingsService systemSettingsService;

    public SslWebServerFactoryCustomizer(SystemSettingsService systemSettingsService) {
        this.systemSettingsService = systemSettingsService;
    }

    @Override
    public void customize(ConfigurableWebServerFactory factory) {
        try {
            boolean sslEnabled = systemSettingsService.getBoolean("orion.ssl.enabled", false);
            if (!sslEnabled) {
                log.info("Server SSL is disabled in system settings. Launching in HTTP mode.");
                return;
            }

            String keystoreBase64 = systemSettingsService.getString("orion.ssl.keystore.base64", "");
            String keystorePassword = systemSettingsService.getString("orion.ssl.keystore.password", "");
            String keystoreType = systemSettingsService.getString("orion.ssl.keystore.type", "PKCS12");
            String keyAlias = systemSettingsService.getString("orion.ssl.key.alias", "");

            if (keystoreBase64.isBlank()) {
                log.warn("Server SSL is enabled but no keystore is configured. Falling back to HTTP mode.");
                return;
            }

            log.info("Server SSL is enabled. Generating temporary keystore file...");
            byte[] keystoreBytes = Base64.getDecoder().decode(keystoreBase64.trim());
            
            // Create a temp file to store the keystore bytes so Tomcat can read it
            File tempKeystore = File.createTempFile("orion_ssl_", ".keystore");
            tempKeystore.deleteOnExit();
            try (FileOutputStream fos = new FileOutputStream(tempKeystore)) {
                fos.write(keystoreBytes);
            }

            Ssl ssl = new Ssl();
            ssl.setEnabled(true);
            ssl.setKeyStore(tempKeystore.getAbsolutePath());
            ssl.setKeyStorePassword(keystorePassword);
            ssl.setKeyStoreType(keystoreType);
            if (!keyAlias.isBlank()) {
                ssl.setKeyAlias(keyAlias);
            }

            factory.setSsl(ssl);
            log.info("Successfully configured server HTTPS factory using keystore path: {}", tempKeystore.getAbsolutePath());
        } catch (Exception e) {
            log.error("Failed to customize web server factory for SSL: {}", e.getMessage(), e);
        }
    }
}
