package com.michael21.SoundFilter.audio.controller;

import com.michael21.SoundFilter.audio.data.AudioModificationResponse;
import com.michael21.SoundFilter.audio.data.TranscriptionResult;
import com.michael21.SoundFilter.audio.service.AudioService;
import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.util.exception.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
            log.info("Transcribe audio request received - Project ID: {}", project_id);
            TranscriptionResult result = audioService.transcribeAudio(user, project_id);
            return ResponseEntity.ok(result);
        } catch (ApiException e) {
            log.error("API Exception in transcribe audio: {}", e.getMessage());
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
    public ResponseEntity<AudioModificationResponse> muteAudio(
            @AuthenticationPrincipal User user,
            @PathVariable Long project_id,
            @RequestParam("start_time") Double start_time,
            @RequestParam("end_time") Double end_time
    ) {
        try {
            log.info("Mute audio request received - Project ID: {}, Start Time: {}, End Time: {}",
                    project_id, start_time, end_time);

            if (start_time == null || end_time == null) {
                throw ApiException.builder()
                        .status(HttpServletResponse.SC_BAD_REQUEST)
                        .message("Start time and end time are required")
                        .build();
            }

            if (start_time >= end_time) {
                throw ApiException.builder()
                        .status(HttpServletResponse.SC_BAD_REQUEST)
                        .message("Start time must be less than end time")
                        .build();
            }

            AudioModificationResponse response = audioService.muteAudio(user, project_id, start_time, end_time);
            return ResponseEntity.ok(response);
        } catch (ApiException e) {
            log.error("API Exception in mute audio: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Error muting audio: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }

    @PostMapping("/{project_id}/replace-with-tts")
    public ResponseEntity<AudioModificationResponse> replaceWithTts(
            @AuthenticationPrincipal User user,
            @PathVariable Long project_id,
            @RequestParam("start_time") Double start_time,
            @RequestParam("replacement_text") String replacement_text,
            @RequestParam(value = "end_time", required = false) Double end_time,
            @RequestParam(value = "use_edge_tts", required = false, defaultValue = "false") Boolean use_edge_tts,
            @RequestParam(value = "gender", required = false) String gender,
            @RequestParam(value = "output_format", required = false) String output_format
    ) {
        try {
            log.info("Replace with TTS request received - Project ID: {}, Start Time: {}, End Time: {}, Text: {}",
                    project_id, start_time, end_time, replacement_text);

            if (start_time == null) {
                throw ApiException.builder()
                        .status(HttpServletResponse.SC_BAD_REQUEST)
                        .message("Start time is required")
                        .build();
            }

            if (replacement_text == null || replacement_text.trim().isEmpty()) {
                throw ApiException.builder()
                        .status(HttpServletResponse.SC_BAD_REQUEST)
                        .message("Replacement text is required")
                        .build();
            }

            if (end_time != null && start_time >= end_time) {
                throw ApiException.builder()
                        .status(HttpServletResponse.SC_BAD_REQUEST)
                        .message("Start time must be less than end time")
                        .build();
            }

            AudioModificationResponse response = audioService.replaceWithTts(
                    user,
                    project_id,
                    start_time,
                    replacement_text,
                    end_time,
                    use_edge_tts,
                    gender,
                    output_format
            );
            return ResponseEntity.ok(response);
        } catch (ApiException e) {
            log.error("API Exception in replace with TTS: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Error replacing with TTS: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }
}