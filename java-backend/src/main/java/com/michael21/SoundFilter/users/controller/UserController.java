package com.michael21.SoundFilter.users.controller;

import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.*;
import com.michael21.SoundFilter.users.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.coyote.Response;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.view.RedirectView;

@Slf4j
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

    @PatchMapping("/{id}/profile-picture")
    public ResponseEntity<UserResponse> updateProfilePicture(
            @PathVariable Long id, @RequestParam("file") MultipartFile file) {
        UserResponse user = userService.updateProfilePicture(id, file);
        return ResponseEntity.ok(user);
    }

    @PostMapping(value = "/create-audio-project")
    public ResponseEntity<UserResponse> addAudioProject(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("description") String description) {

        UserResponse user = userService.addAudioProject(name, description, file);
        return ResponseEntity.ok(user);
    }

    @PatchMapping("{id}/project-details")
    public ResponseEntity<UserResponse> updateProjectDetails(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProjectDetailsRequest request) {
        UserResponse user = userService.updateProjectDetails(id, request);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("{id}/delete-project")
    public ResponseEntity<UserResponse> deleteProject(@PathVariable Long id) {
        UserResponse user = userService.deleteProject(id);
        return ResponseEntity.ok(user);
    }
}
