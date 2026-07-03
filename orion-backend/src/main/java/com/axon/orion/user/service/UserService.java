package com.axon.orion.user.service;

import com.axon.orion.common.dto.PagedResponse;
import com.axon.orion.common.exception.DuplicateResourceException;
import com.axon.orion.common.exception.ForbiddenException;
import com.axon.orion.common.exception.ResourceNotFoundException;
import com.axon.orion.common.exception.UnauthorizedException;
import com.axon.orion.user.dto.UserDtos;
import com.axon.orion.user.entity.User;
import com.axon.orion.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public PagedResponse<UserDtos.UserDto> listUsers(int page, int size, String search, String sort) {
        String[] sortParts = sort != null ? sort.split(",") : new String[]{"createdAt", "desc"};
        String sortField = sortParts[0];
        Sort.Direction direction = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(direction, sortField));
        Page<User> userPage = userRepository.findAllWithSearch(search, pageRequest);

        List<UserDtos.UserDto> dtos = userPage.getContent().stream()
                .map(UserDtos::toDto)
                .toList();
        return PagedResponse.of(dtos, page, size, userPage.getTotalElements());
    }

    public UserDtos.UserDto getUserById(String id) {
        User user = findById(id);
        return UserDtos.toDto(user);
    }

    @Transactional
    public UserDtos.UserDto updateUser(String id, UserDtos.UpdateUserRequest request) {
        User user = findById(id);

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new DuplicateResourceException("User", "email", request.getEmail());
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        return UserDtos.toDto(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String id, UserDtos.ChangePasswordRequest request, User currentUser) {
        if (!currentUser.getId().equals(id)) {
            throw new ForbiddenException("You can only change your own password");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), currentUser.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        currentUser.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(currentUser);
    }

    @Transactional
    public UserDtos.UserDto changeRole(String id, UserDtos.ChangeRoleRequest request) {
        User user = findById(id);
        user.setRole(request.getRole());
        return UserDtos.toDto(userRepository.save(user));
    }

    @Transactional
    public UserDtos.UserDto changeStatus(String id, UserDtos.ChangeStatusRequest request) {
        User user = findById(id);
        user.setActive(request.isActive());
        return UserDtos.toDto(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(String id) {
        User user = findById(id);
        user.setActive(false); // Soft delete
        userRepository.save(user);
    }

    private User findById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
