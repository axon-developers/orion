package com.axon.orion.user.service;

import com.axon.orion.user.entity.User;
import com.axon.orion.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SamlUserProvisioningService {

    private final UserRepository userRepository;

    @Transactional
    public User provisionUser(Saml2Authentication saml2Auth) {
        Saml2AuthenticatedPrincipal principal = (Saml2AuthenticatedPrincipal) saml2Auth.getPrincipal();
        
        String nameId = principal.getName();
        log.info("Provisioning SAML user with NameID: {}", nameId);

        String email = getAttributeValue(principal, "email", "mail", "User.email");
        if (email == null || email.isBlank()) {
            email = nameId;
        }

        String fullName = getAttributeValue(principal, "cn", "displayName", "name", "User.FirstName", "User.LastName");
        if (fullName == null || fullName.isBlank()) {
            fullName = email.split("@")[0];
        }

        String username = getAttributeValue(principal, "uid", "username", "User.username");
        if (username == null || username.isBlank()) {
            username = email.split("@")[0];
        }

        final String finalUsername = username;
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> userRepository.findByUsername(finalUsername).orElse(null));

        if (user == null) {
            log.info("SAML user not found, auto-provisioning new account: email={}, username={}", email, username);
            user = new User();
            user.setEmail(email);
            user.setUsername(username);
            user.setFullName(fullName);
            user.setRole(User.Role.VIEWER);
            user.setPasswordHash("SAML_USER_EXTERNAL_NO_PASSWORD_" + UUID.randomUUID().toString());
            user.setActive(true);
            user = userRepository.save(user);
        } else {
            log.info("SAML user found in database, logging in: {}", user.getUsername());
        }

        return user;
    }

    private String getAttributeValue(Saml2AuthenticatedPrincipal principal, String... attributeNames) {
        for (String name : attributeNames) {
            List<Object> values = principal.getAttribute(name);
            if (values != null && !values.isEmpty()) {
                Object val = values.get(0);
                if (val != null) {
                    return val.toString();
                }
            }
        }
        return null;
    }
}
