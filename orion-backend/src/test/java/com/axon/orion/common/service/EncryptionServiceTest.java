package com.axon.orion.common.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

public class EncryptionServiceTest {

    @Test
    public void testEncryptAndDecrypt() {
        EncryptionService encryptionService = new EncryptionService("MyTestSecretKeyForTestingEncryptionService2026!");
        String plaintext = "my-secure-password";

        String encrypted = encryptionService.encrypt(plaintext);
        assertThat(encrypted).isNotNull();
        assertThat(encrypted).isNotEqualTo(plaintext);

        String decrypted = encryptionService.decrypt(encrypted);
        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    public void testDecryptLegacyPlaintext() {
        EncryptionService encryptionService = new EncryptionService("MyTestSecretKeyForTestingEncryptionService2026!");
        String legacy = "legacy_plain_password";
        String decrypted = encryptionService.decrypt(legacy);
        assertThat(decrypted).isEqualTo(legacy);
    }
}
