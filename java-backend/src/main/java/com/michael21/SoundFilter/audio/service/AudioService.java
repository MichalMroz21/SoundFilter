package com.michael21.SoundFilter.audio.service;

import com.michael21.SoundFilter.audio.AudioUtil;
import com.michael21.SoundFilter.audio.data.TranscriptionResult;
import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.s3.service.FileService;
import com.michael21.SoundFilter.users.AudioProject;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.users.repository.AudioProjectRepository;
import com.michael21.SoundFilter.util.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.util.Pair;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudioService {
    private final AudioProjectRepository audioProjectRepository;
    private final FileService fileService;
    private final ObjectMapper objectMapper;
    private final ApplicationProperties applicationProperties;

    public AudioProject getAudioProject(User user, Long project_id) {
        AudioProject audioProject = audioProjectRepository.findById(project_id)
                .orElseThrow(() -> ApiException.builder().status(HttpServletResponse.SC_NOT_FOUND).
                        message("Project not found").build());

        if (!(audioProject.getUser().getId() == user.getId())) {
            throw ApiException.builder().status(HttpServletResponse.SC_FORBIDDEN).
                    message("This user doesn't have access to this project").build();
        }

        return audioProject;
    }

    /**
     * Downloads an audio file from the provided URL and sends it to the Python API for transcription.
     *
     * @param user The authenticated user
     * @param projectId The ID of the audio project to transcribe
     * @return The transcription result from the Python API
     * @throws ApiException If there's an error accessing the project or processing the audio
     */
    public TranscriptionResult transcribeAudio(User user, Long projectId) {
        AudioProject audioProject = getAudioProject(user, projectId);
        String audioUrl = audioProject.getAudioUrl();

        if (audioUrl == null || audioUrl.isEmpty()) {
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_BAD_REQUEST)
                    .message("Audio URL is missing for this project")
                    .build();
        }

        String fileName = audioUrl.substring(audioUrl.lastIndexOf("/") + 1);

        byte[] audioData;

        try {
            log.info("Downloading audio file from URL: {}", audioUrl);
            URL url = new URL(audioUrl);
            try (InputStream in = url.openStream()) {
                audioData = in.readAllBytes();
            }

            log.info("Successfully downloaded {} bytes", audioData.length);
        } catch (IOException e) {

            log.error("Error downloading audio file: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error downloading audio file: " + e.getMessage())
                    .build();
        }

        try {
            log.info("Sending audio file to Python API for transcription");
            RestTemplate restTemplate = new RestTemplate();

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource resource = new ByteArrayResource(audioData) {
                @Override
                public String getFilename() {
                    return fileName;
                }
            };

            body.add("audio_file", resource);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    applicationProperties.getBaseUrl() + "/audio-api/transcribe",
                    requestEntity,
                    String.class);

            log.info("Received response from Python API with status: {}", response.getStatusCode());

            // Convert the JSON response to our TranscriptionResult object
            TranscriptionResult result = objectMapper.readValue(response.getBody(), TranscriptionResult.class);

            // Update the audio project with the transcription if needed
            // audioProject.setTranscript(result.getTranscript());
            // audioProjectRepository.save(audioProject);

            return result;

        } catch (Exception e) {
            log.error("Error sending file to Python API: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }
}