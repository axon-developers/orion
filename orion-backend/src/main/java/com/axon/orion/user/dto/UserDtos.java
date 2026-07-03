package com.axon.orion.user.dto;

import com.axon.orion.user.entity.User;
import jakarta.validation.constraints.*;
import lombok.Data;

public class UserDtos {

    @Data
    public static class UserDto {
        private String id;
        private String username;
        private String email;
        private String fullName;
        private String role;
        private boolean isActive;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    public static class UpdateUserRequest {
        @Size(max = 100, message = "Full name must not exceed 100 characters")
        private String fullName;

        @Email(message = "Email must be valid")
        private String email;
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "Current password is required")
        private String currentPassword;

        @NotBlank(message = "New password is required")
        @Size(min = 8, message = "New password must be at least 8 characters")
        private String newPassword;
    }

    @Data
    public static class ChangeRoleRequest {
        @NotNull(message = "Role is required")
        private User.Role role;
    }

    @Data
    public static class ChangeStatusRequest {
        private boolean isActive;
    }

    public static UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFullName(user.getFullName());
        dto.setRole(user.getRole().name());
        dto.setActive(user.isActive());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }
}
