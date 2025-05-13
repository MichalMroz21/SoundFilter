package com.michael21.SoundFilter.audio;

import com.michael21.SoundFilter.config.ApplicationProperties;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

public class AudioUtil {
    public static String determineContentType(String extension) {
        switch (extension.toLowerCase()) {
            case "mp3":
                return "audio/mpeg";
            case "wav":
                return "audio/wav";
            case "ogg":
                return "audio/ogg";
            case "flac":
                return "audio/flac";
            case "aac":
                return "audio/aac";
            default:
                return "application/octet-stream";
        }
    }

    /**
     * Makes a request to the Python API with configurable endpoint and response type
     *
     * @param audioData The audio file data as byte array
     * @param fileName The name of the audio file
     * @param endpoint The API endpoint to call (e.g., "/audio-api/transcribe")
     * @param additionalParams Additional parameters to include in the request
     * @param responseType The class type for the response
     * @param <T> The type of response expected
     * @return ResponseEntity containing the response from the Python API
     */
    /**
     * Makes a request to the Python API with configurable endpoint and response type
     *
     * @param audioData The audio file data as byte array
     * @param fileName The name of the audio file
     * @param endpoint The API endpoint to call (e.g., "/audio-api/transcribe")
     * @param additionalParams Additional parameters to include in the request
     * @param responseType The class type for the response
     * @param <T> The type of response expected
     * @return The response from the Python API converted to the specified type
     * @throws ApiException If there's an error calling the API
     */
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

            // Make the request
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