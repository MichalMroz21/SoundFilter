package com.michael21.SoundFilter.audio.data;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AudioModificationResponse {
    private Long projectId;
    private String audioUrl;
}