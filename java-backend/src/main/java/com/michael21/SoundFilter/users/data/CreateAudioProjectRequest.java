package com.michael21.SoundFilter.users.data;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateAudioProjectRequest {
    @NotBlank(message = "Project name is required")
    private String name;

    private String description;
}
