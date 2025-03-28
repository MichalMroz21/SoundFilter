package com.michael21.SoundFilter.users.controller;

import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.*;
import com.michael21.SoundFilter.users.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final ApplicationProperties applicationProperties;

    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        UserResponse user = userService.create(request);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/verify-email")
    public RedirectView verifyEmail(@RequestParam String token) {
        userService.verifyEmail(token);
        return new RedirectView(applicationProperties.getLoginPageUrl());
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        userService.forgotPassword(req.getEmail());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody UpdateUserPasswordRequest requestDTO) {
        userService.resetPassword(requestDTO);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(@Valid @RequestBody UpdateUserRequest request) {
        UserResponse user = userService.update(request);
        return ResponseEntity.ok(user);
    }

    @PatchMapping("/password")
    public ResponseEntity<UserResponse> updatePassword(@Valid @RequestBody UpdateUserPasswordRequest requestDTO) {
        UserResponse user = userService.updatePassword(requestDTO);
        return ResponseEntity.ok(user);
    }
}
