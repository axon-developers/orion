package com.axon.orion.common.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Slf4j
@Service
public class EncryptionService {

    private final SecretKeySpec secretKey;
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";

    public EncryptionService(@Value("${orion.encryption.key:OrionSecretEncryptionKeyFallback2026!}") String rawKey) {
        SecretKeySpec keySpec = null;
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            keySpec = new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            log.error("Failed to initialize EncryptionService secret key: {}", e.getMessage());
        }
        this.secretKey = keySpec;
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        if (secretKey == null) {
            log.warn("Encryption failed: secret key not initialized");
            return plaintext;
        }
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            byte[] iv = new byte[16];
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);

            cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Failed to encrypt: {}", e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return ciphertext;
        }
        if (secretKey == null) {
            log.warn("Decryption skipped: secret key not initialized");
            return ciphertext;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertext.trim());
            if (combined.length < 16) {
                return ciphertext;
            }

            byte[] iv = new byte[16];
            byte[] encrypted = new byte[combined.length - 16];
            System.arraycopy(combined, 0, iv, 0, 16);
            System.arraycopy(combined, 16, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);

            byte[] decrypted = cipher.doFinal(encrypted);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.debug("Failed to decrypt (assuming legacy plaintext): {}", e.getMessage());
            return ciphertext;
        }
    }
}
