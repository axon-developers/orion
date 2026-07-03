package com.axon.orion.config;

import com.axon.orion.user.entity.User;
import com.axon.orion.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("Running AdminInitializer check...");
        
        String freshHash = passwordEncoder.encode("Admin@123");
        
        userRepository.findByUsername("admin").ifPresentOrElse(
            admin -> {
                log.info("Admin user already exists. Overwriting with fresh password hash of Admin@123 to ensure validity...");
                admin.setPasswordHash(freshHash);
                admin.setActive(true);
                userRepository.save(admin);
                log.info("Admin user password hash updated successfully.");
            },
            () -> {
                log.info("Admin user not found in database. Initializing default admin...");
                User admin = new User();
                admin.setUsername("admin");
                admin.setEmail("admin@orion.local");
                admin.setPasswordHash(freshHash);
                admin.setFullName("System Administrator");
                admin.setRole(User.Role.ADMIN);
                admin.setActive(true);
                userRepository.save(admin);
                log.info("Default admin user created successfully (admin / Admin@123).");
            }
        );
    }
}
