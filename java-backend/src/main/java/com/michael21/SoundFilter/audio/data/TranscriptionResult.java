package com.michael21.SoundFilter.audio.data;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class TranscriptionResult {
    private String filename;
    private String transcript;
    private List<WordTimestamp> words;

    @JsonProperty("detected_language")
    private String detectedLanguage;

    @JsonProperty("processing_time")
    private double processingTime;

    @Data
    public static class WordTimestamp {
        private String word;

        @JsonProperty("start_time")
        private double startTime;

        @JsonProperty("end_time")
        private double endTime;
    }
}