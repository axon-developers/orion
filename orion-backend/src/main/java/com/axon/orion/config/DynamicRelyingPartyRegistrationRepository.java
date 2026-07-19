package com.axon.orion.config;

import com.axon.orion.admin.service.SystemSettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.saml2.core.Saml2X509Credential;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;

@Component
@RequiredArgsConstructor
@Slf4j
public class DynamicRelyingPartyRegistrationRepository implements RelyingPartyRegistrationRepository {

    private final SystemSettingsService systemSettingsService;

    @Override
    public RelyingPartyRegistration findByRegistrationId(String registrationId) {
        if (!"orion".equals(registrationId)) {
            return null;
        }

        boolean enabled = systemSettingsService.getBoolean("saml.enabled", false);
        if (!enabled) {
            log.warn("SAML authentication is disabled in system settings.");
            return null;
        }

        String idpEntityId = systemSettingsService.getString("saml.idp.entity_id", "");
        String ssoUrl = systemSettingsService.getString("saml.idp.sso_url", "");
        String spEntityId = systemSettingsService.getString("saml.sp.entity_id", "http://localhost:8080/saml2/service-provider-metadata/orion");
        String acsUrl = systemSettingsService.getString("saml.sp.acs_url", "http://localhost:8080/login/saml2/sso/orion");
        String certPem = systemSettingsService.getString("saml.idp.verification_cert", "");

        if (idpEntityId.isBlank() || ssoUrl.isBlank() || certPem.isBlank()) {
            log.error("SAML settings are incomplete. Please verify Entity ID, SSO URL, and Certificate.");
            return null;
        }

        try {
            // Parse PEM certificate
            String cleanPem = certPem
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replaceAll("\\s+", "");
            byte[] decoded = Base64.getDecoder().decode(cleanPem);
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate certificate = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(decoded));

            Saml2X509Credential credential = Saml2X509Credential.verification(certificate);

            return RelyingPartyRegistration.withRegistrationId("orion")
                    .assertingPartyDetails(party -> party
                            .entityId(idpEntityId)
                            .singleSignOnServiceLocation(ssoUrl)
                            .verificationX509Credentials(creds -> creds.add(credential))
                    )
                    .entityId(spEntityId)
                    .assertionConsumerServiceLocation(acsUrl)
                    .build();

        } catch (Exception e) {
            log.error("Failed to build RelyingPartyRegistration for SAML: {}", e.getMessage(), e);
            return null;
        }
    }
}
