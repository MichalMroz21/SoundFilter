package com.michael21.SoundFilter.audio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.michael21.SoundFilter.util.exception.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import com.michael21.SoundFilter.config.ApplicationProperties;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AudioUtil {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ApplicationProperties applicationProperties;

    public <T> T callPythonApi(
            byte[] audioData,
            String fileName,
            String endpoint,
            Map<String, Object> additionalParams,
            Class<T> responseType) {

        try {
            log.info("Sending request to Python API endpoint: {}", endpoint);

            // Create multipart request body
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            // Add the audio file if provided
            if (audioData != null && fileName != null) {
                ByteArrayResource resource = new ByteArrayResource(audioData) {
                    @Override
                    public String getFilename() {
                        return fileName;
                    }
                };
                body.add("audio_file", resource);
            }

            // Add any additional parameters
            if (additionalParams != null) {
                additionalParams.forEach((key, value) -> body.add(key, value));
            }

            // Set up headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // Create the request entity
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            // For binary responses (byte[]), use exchange method instead of postForEntity
            if (responseType == byte[].class) {
                log.info("Expecting binary response, using exchange method");
                ResponseEntity<byte[]> response = restTemplate.exchange(
                        applicationProperties.getBaseUrl() + endpoint,
                        org.springframework.http.HttpMethod.POST,
                        requestEntity,
                        byte[].class);

                log.info("Received binary response with status: {}, content length: {}",
                        response.getStatusCode(),
                        response.getBody() != null ? response.getBody().length : 0);

                return (T) response.getBody();
            }

            // For other response types, use postForEntity as before
            ResponseEntity<String> response = restTemplate.postForEntity(
                    applicationProperties.getBaseUrl() + endpoint,
                    requestEntity,
                    String.class);  // Always get the raw response as String

            log.info("Received response from Python API with status: {}", response.getStatusCode());

            // If the requested type is String, return it directly
            if (responseType == String.class) {
                return (T) response.getBody();
            }

            // Otherwise, convert the JSON response to the requested type
            return objectMapper.readValue(response.getBody(), responseType);

        } catch (JsonProcessingException e) {
            log.error("Error parsing JSON response: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error parsing API response: " + e.getMessage())
                    .build();
        } catch (Exception e) {
            log.error("Error calling Python API: {}", e.getMessage(), e);
            throw ApiException.builder()
                    .status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .message("Error calling Python API: " + e.getMessage())
                    .build();
        }
    }
}
