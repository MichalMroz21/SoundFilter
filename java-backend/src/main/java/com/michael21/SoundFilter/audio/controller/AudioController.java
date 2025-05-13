package com.michael21.SoundFilter.audio.controller;

import com.michael21.SoundFilter.audio.data.TranscriptionResult;
import com.michael21.SoundFilter.audio.service.AudioService;
import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.users.AudioProject;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.util.exception.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@RestController
@RequestMapping("/api/audio")
@RequiredArgsConstructor
public class AudioController {
    private final AudioService audioService;
    private final ApplicationProperties applicationProperties;

    @PostMapping("/{project_id}/transcribe")
    public ResponseEntity<TranscriptionResult> transcribeAudio(
            @AuthenticationPrincipal User user,
            @PathVariable Long project_id
    ) {
        try {
            TranscriptionResult result = audioService.transcribeAudio(user, project_id);
            return ResponseEntity.ok(result);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error transcribing audio: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }

    @PostMapping("/{project_id}/mute-audio")
    public ResponseEntity<UserResponse> muteAudio(
            @AuthenticationPrincipal User user,
            @PathVariable Long project_id,
            @RequestParam("start_time") Double start_time,
            @RequestParam("end_time") Double end_time
    ) {
        try {
            return ResponseEntity.ok(audioService.muteAudio(user, project_id, start_time, end_time));
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error muting audio: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }
}