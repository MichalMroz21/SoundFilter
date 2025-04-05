package com.michael21.SoundFilter.users.data;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateProjectDetailsRequest {
    @NotBlank(message = "Project name cannot be empty")
    private String name;

    private String description;
}