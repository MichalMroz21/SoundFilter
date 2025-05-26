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
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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

    @PersistenceContext
    private EntityManager entityManager;

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

        AudioProject savedProject = audioProjectRepository.saveAndFlush(createdProject);

        user.addAudioProject(savedProject);

        userRepository.saveAndFlush(user);

        // Force flush to ensure all changes are written to the database
        entityManager.flush();

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
            audioProjectRepository.saveAndFlush(audioProject);

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
        log.info("Starting muteAudio operation for project {}", projectId);
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
            log.info("Generated new file path: {}", filePath);
            String newAudioUrl = fileService.uploadFile(filePath, modifiedAudio);
            log.info("New audio URL from S3: {}", newAudioUrl);

            uploadedFile.onUploaded(newAudioUrl);
            uploadedFileRepository.saveAndFlush(uploadedFile);

            // Update the project with the new audio URL
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.saveAndFlush(audioProject);

            // Force flush and clear the persistence context to ensure changes are committed
            // and the cache is cleared
            entityManager.flush();
            entityManager.clear();

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
    public AudioModificationResponse replaceWithTone(
            User user,
            Long projectId,
            Double startTime,
            Double endTime,
            Integer toneFrequency) {

        log.info("Starting replaceWithTone operation for project {}", projectId);
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
            log.info("Sending audio file to Python API for tone replacement");

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
            body.add("modification_type", "tone");
            body.add("tone_frequency", toneFrequency.toString());
            body.add("output_format", audioProject.getAudioFormat());

            log.info("Sending parameters to Python API: start_time={}, end_time={}, modification_type=tone, tone_frequency={}, output_format={}",
                    startTime, endTime, toneFrequency, audioProject.getAudioFormat());

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

            // Try to delete the old file
            try {
                String oldFilePath = extractFilePathFromUrl(audioProject.getAudioUrl());
                if (oldFilePath != null) {
                    fileService.deleteFile(oldFilePath);
                    log.info("Deleted old audio file: {}", oldFilePath);
                }
            } catch (Exception e) {
                log.warn("Could not delete old audio file: {}", e.getMessage());
            }

            // Generate a new unique filename for the modified audio
            String newFileName = UUID.randomUUID().toString() + "." + audioProject.getAudioFormat();
            String filePath = "user:" + user.getId() + "/audio-file/" + newFileName;
            String newAudioUrl = fileService.uploadFile(filePath, modifiedAudio);

            log.info("New audio URL from S3: {}", newAudioUrl);

            // Create and save the uploaded file record
            UploadedFile uploadedFile = new UploadedFile(
                    originalFileName,
                    (long) modifiedAudio.length,
                    user
            );
            uploadedFile.onUploaded(newAudioUrl);
            uploadedFileRepository.saveAndFlush(uploadedFile);

            // Update the project with the new audio URL
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.saveAndFlush(audioProject);

            // Force flush and clear the persistence context
            entityManager.flush();
            entityManager.clear();

            // Return the new audio URL in the response
            return new AudioModificationResponse(projectId, newAudioUrl);

        } catch (Exception e) {
            log.error("Error replacing with tone: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error replacing with tone: " + e.getMessage())
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

        log.info("Starting replaceWithTts operation for project {}", projectId);
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

            // Try to delete the old file
            try {
                String oldFilePath = extractFilePathFromUrl(audioProject.getAudioUrl());
                if (oldFilePath != null) {
                    fileService.deleteFile(oldFilePath);
                    log.info("Deleted old audio file: {}", oldFilePath);
                }
            } catch (Exception e) {
                log.warn("Could not delete old audio file: {}", e.getMessage());
            }

            // Generate a new unique filename for the modified audio
            String newFileName = UUID.randomUUID().toString() + "." + outputFormat;
            String filePath = "user:" + user.getId() + "/audio-file/" + newFileName;
            String newAudioUrl = fileService.uploadFile(filePath, modifiedAudio);

            log.info("New audio URL from S3: {}", newAudioUrl);

            // Create and save the uploaded file record
            UploadedFile uploadedFile = new UploadedFile(
                    originalFileName,
                    (long) modifiedAudio.length,
                    user
            );
            uploadedFile.onUploaded(newAudioUrl);
            uploadedFileRepository.saveAndFlush(uploadedFile);

            // Update the project with the new audio URL
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.saveAndFlush(audioProject);

            // Force flush and clear the persistence context to ensure changes are committed
            // and the cache is cleared
            entityManager.flush();
            entityManager.clear();

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

    @Transactional
    public AudioModificationResponse convertAudioFormat(User user, Long projectId, String targetFormat) {
        log.info("Starting convertAudioFormat operation for project {} to format {}", projectId, targetFormat);
        AudioProject audioProject = getAudioProject(user, projectId);
        String audioUrl = audioProject.getAudioUrl();

        if (audioUrl == null || audioUrl.isEmpty()) {
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_BAD_REQUEST)
                    .message("Audio URL is missing for this project")
                    .build();
        }

        // Check if already in target format
        if (targetFormat.equalsIgnoreCase(audioProject.getAudioFormat())) {
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_BAD_REQUEST)
                    .message("Audio is already in " + targetFormat + " format")
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
            log.info("Sending audio file to Python API for format conversion");

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource resource = new ByteArrayResource(audioData) {
                @Override
                public String getFilename() {
                    return originalFileName;
                }
            };

            body.add("audio_file", resource);
            body.add("target_format", targetFormat);

            log.info("Sending parameters to Python API: target_format={}", targetFormat);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            byte[] convertedAudio = restTemplate.postForObject(
                    applicationProperties.getBaseUrl() + "/audio-api/convert-format",
                    requestEntity,
                    byte[].class
            );

            if (convertedAudio == null || convertedAudio.length == 0) {
                throw new RuntimeException("Received empty response from Python API");
            }

            log.info("Received converted audio: {} bytes", convertedAudio.length);

            // Try to delete the old file
            try {
                String oldFilePath = extractFilePathFromUrl(audioProject.getAudioUrl());
                if (oldFilePath != null) {
                    fileService.deleteFile(oldFilePath);
                    log.info("Deleted old audio file: {}", oldFilePath);
                }
            } catch (Exception e) {
                log.warn("Could not delete old audio file: {}", e.getMessage());
            }

            // Generate a new unique filename for the converted audio
            String newFileName = UUID.randomUUID().toString() + "." + targetFormat;
            String filePath = "user:" + user.getId() + "/audio-file/" + newFileName;
            String newAudioUrl = fileService.uploadFile(filePath, convertedAudio);

            log.info("New audio URL from S3: {}", newAudioUrl);

            // Create and save the uploaded file record
            UploadedFile uploadedFile = new UploadedFile(
                    originalFileName.substring(0, originalFileName.lastIndexOf('.')) + "." + targetFormat,
                    (long) convertedAudio.length,
                    user
            );
            uploadedFile.onUploaded(newAudioUrl);
            uploadedFileRepository.saveAndFlush(uploadedFile);

            // Update the project with the new audio URL and format
            audioProject.setAudioUrl(newAudioUrl);
            audioProject.setAudioFormat(targetFormat);
            audioProject.setFileSize((long) convertedAudio.length);
            audioProject.setUpdatedAt(LocalDateTime.now());
            audioProjectRepository.saveAndFlush(audioProject);

            // Force flush and clear the persistence context
            entityManager.flush();
            entityManager.clear();

            // Return the new audio URL in the response
            return new AudioModificationResponse(projectId, newAudioUrl);

        } catch (Exception e) {
            log.error("Error converting audio format: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error converting audio format: " + e.getMessage())
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
