package com.michael21.SoundFilter.audio.data;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class TranscriptionResult {
    private String filename;
    private String transcript;
    private List<WordTimestamp> words;
    private @JsonProperty("detected_language") String detectedLanguage;
    private @JsonProperty("processing_time") double processingTime;

    public record WordTimestamp(String word,
                                @JsonProperty("start_time") double startTime,
                                @JsonProperty("end_time") double endTime) {}
}