package com.michael21.SoundFilter.audio;

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
}
