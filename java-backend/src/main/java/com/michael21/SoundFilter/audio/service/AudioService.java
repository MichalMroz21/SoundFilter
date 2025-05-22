package com.michael21.SoundFilter.audio.service;

import com.michael21.SoundFilter.audio.data.AudioModificationResponse;
import com.michael21.SoundFilter.audio.data.TranscriptionResult;
import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.s3.UploadedFile;
import com.michael21.SoundFilter.s3.repository.UploadedFileRepository;
import com.michael21.SoundFilter.s3.service.FileService;
import com.michael21.SoundFilter.users.AudioProject;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.users.repository.AudioProjectRepository;
import com.michael21.SoundFilter.users.repository.UserRepository;
import com.michael21.SoundFilter.util.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudioService {
    private final AudioProjectRepository audioProjectRepository;
    private final UserRepository userRepository;
    private final UploadedFileRepository uploadedFileRepository;
    private final FileService fileService;
    private final ObjectMapper objectMapper;
    private final ApplicationProperties applicationProperties;
    private final RestTemplate restTemplate;

    public AudioProject getAudioProject(User user, Long projectId) {
        AudioProject audioProject = audioProjectRepository.findById(projectId)
                .orElseThrow(() -> ApiException.builder().status(HttpServletResponse.SC_NOT_FOUND).
                        message("Project not found").build());

        if (!(audioProject.getUser().getId() == user.getId())) {
            throw ApiException.builder().status(HttpServletResponse.SC_FORBIDDEN).
                    message("This user doesn't have access to this project").build();
        }

        return audioProject;
    }

    @Transactional
    public UserResponse addAudioProject(String name, String description, MultipartFile file) {
        User user = SecurityUtil.getAuthenticatedUser();

        UploadedFile uploadedFile = new UploadedFile(file.getOriginalFilename(), file.getSize(), user);

        String url = "";

        try {
            url = fileService.uploadFile(
                    uploadedFile.buildPath("audio-file"),
                    file.getBytes()
            );
            uploadedFile.onUploaded(url);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        AudioProject createdProject = new AudioProject(name, description, user, file, url,
                uploadedFile.getCreatedAt(), uploadedFile.getExtension());

        AudioProject savedProject = audioProjectRepository.save(createdProject);

        user.addAudioProject(savedProject);

        userRepository.save(user);

        return new UserResponse(user);
    }

    @Transactional
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

            String jsonResponse = restTemplate.postForObject(
                    applicationProperties.getBaseUrl() + "/audio-api/transcribe",
                    requestEntity,
                    String.class
            );

            TranscriptionResult result = objectMapper.readValue(jsonResponse, TranscriptionResult.class);

            audioProject.setTranscriptionText(result.getTranscript());
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.save(audioProject);

            return result;

        } catch (Exception e) {
            log.error("Error sending file to Python API: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error processing audio: " + e.getMessage())
                    .build();
        }
    }

    @Transactional
    public AudioModificationResponse muteAudio(User user, Long projectId, Double startTime, Double endTime) {
        AudioProject audioProject = getAudioProject(user, projectId);
        String audioUrl = audioProject.getAudioUrl();

        if (audioUrl == null || audioUrl.isEmpty()) {
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_BAD_REQUEST)
                    .message("Audio URL is missing for this project")
                    .build();
        }

        String originalFileName = audioUrl.substring(audioUrl.lastIndexOf("/") + 1);

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
            log.info("Sending audio file to Python API for muting");

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource resource = new ByteArrayResource(audioData) {
                @Override
                public String getFilename() {
                    return originalFileName;
                }
            };

            body.add("audio_file", resource);
            body.add("start_time", startTime.toString());
            body.add("end_time", endTime.toString());
            body.add("modification_type", "mute");
            body.add("output_format", audioProject.getAudioFormat());

            log.info("Sending parameters to Python API: start_time={}, end_time={}, modification_type=mute, output_format={}",
                    startTime, endTime, audioProject.getAudioFormat());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            byte[] modifiedAudio = restTemplate.postForObject(
                    applicationProperties.getBaseUrl() + "/audio-api/modify",
                    requestEntity,
                    byte[].class
            );

            if (modifiedAudio == null || modifiedAudio.length == 0) {
                throw new RuntimeException("Received empty response from Python API");
            }

            log.info("Received modified audio: {} bytes", modifiedAudio.length);

            // Create a new uploaded file record - this will get a new UUID filename
            UploadedFile uploadedFile = new UploadedFile(
                    originalFileName, // Keep the original filename for reference
                    (long) modifiedAudio.length,
                    user
            );

            // Delete the old file from S3 if it exists
            try {
                String oldFilePath = extractFilePathFromUrl(audioProject.getAudioUrl());
                if (oldFilePath != null) {
                    fileService.deleteFile(oldFilePath);
                    log.info("Deleted old audio file: {}", oldFilePath);
                }
            } catch (Exception e) {
                log.warn("Could not delete old audio file: {}", e.getMessage());
            }

            // Upload the modified audio to S3 - buildPath() will generate a new UUID
            String filePath = uploadedFile.buildPath("audio-file");
            log.info("DEBUG - Generated new file path: {}", filePath);
            String newAudioUrl = fileService.uploadFile(filePath, modifiedAudio);
            log.info("DEBUG - New audio URL from S3: {}", newAudioUrl);

            uploadedFile.onUploaded(newAudioUrl);
            uploadedFileRepository.save(uploadedFile);

            // Update the project with the new audio URL
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.save(audioProject);

            log.info("DEBUG - Final audio URL in project: {}", audioProject.getAudioUrl());

            // Return simplified response with just the project ID and new audio URL
            return new AudioModificationResponse(projectId, newAudioUrl);

        } catch (Exception e) {
            log.error("Error muting audio: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error muting audio: " + e.getMessage())
                    .build();
        }
    }

    @Transactional
    public AudioModificationResponse replaceWithTts(
            User user,
            Long projectId,
            Double startTime,
            String replacementText,
            Double endTime,
            Boolean useEdgeTts,
            String gender,
            String outputFormat) {

        AudioProject audioProject = getAudioProject(user, projectId);
        String audioUrl = audioProject.getAudioUrl();

        if (audioUrl == null || audioUrl.isEmpty()) {
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_BAD_REQUEST)
                    .message("Audio URL is missing for this project")
                    .build();
        }

        String originalFileName = audioUrl.substring(audioUrl.lastIndexOf("/") + 1);

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
            log.info("Sending audio file to Python API for TTS replacement");

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource resource = new ByteArrayResource(audioData) {
                @Override
                public String getFilename() {
                    return originalFileName;
                }
            };

            body.add("audio_file", resource);
            body.add("start_time", startTime.toString());
            body.add("replacement_text", replacementText);

            if (outputFormat == null || outputFormat.isEmpty()) {
                outputFormat = audioProject.getAudioFormat();
            }
            body.add("output_format", outputFormat);

            body.add("use_edge_tts", useEdgeTts.toString());

            if (endTime != null) {
                body.add("end_time", endTime.toString());
            }

            if (gender != null) {
                body.add("gender", gender);
            }

            log.info("Sending parameters to Python API: start_time={}, replacement_text={}, use_edge_tts={}, gender={}, output_format={}",
                    startTime, replacementText, useEdgeTts, gender, outputFormat);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            byte[] modifiedAudio = restTemplate.postForObject(
                    applicationProperties.getBaseUrl() + "/audio-api/replace-with-tts",
                    requestEntity,
                    byte[].class
            );

            if (modifiedAudio == null || modifiedAudio.length == 0) {
                throw new RuntimeException("Received empty response from Python API");
            }

            // Generate a new unique filename for the modified audio
            String newFileName = UUID.randomUUID().toString() + "." + outputFormat;
            String filePath = "user:" + user.getId() + "/audio-file/" + newFileName;
            String newAudioUrl = fileService.uploadFile(filePath, modifiedAudio);

            // Update the project with the new audio URL
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.save(audioProject);

            // Return the new audio URL in the response
            return new AudioModificationResponse(projectId, newAudioUrl);

        } catch (Exception e) {
            log.error("Error replacing with TTS: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error replacing with TTS: " + e.getMessage())
                    .build();
        }
    }

    private String extractFilePathFromUrl(String audioUrl) {
        try {
            URL url = new URL(audioUrl);
            return url.getPath().startsWith("/") ? url.getPath().substring(1) : url.getPath();
        } catch (Exception e) {
            log.error("Error extracting file path from URL: {}", e.getMessage());
            return null;
        }
    }
}