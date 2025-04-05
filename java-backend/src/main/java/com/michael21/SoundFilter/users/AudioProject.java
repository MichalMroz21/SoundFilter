package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.data.CreateAudioProjectRequest;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class AudioProject extends AbstractEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String audioUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String transcriptionText;

    @Column(columnDefinition = "TEXT")
    private String filteredTranscriptionText;

    @Column
    private String audioFormat;

    @Column
    private Long durationInSeconds;

    @Column
    private Long fileSize;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public AudioProject(String name, String description, User user, MultipartFile file,
                        String audioUrl, LocalDateTime createdAt, String extension) {
        this.user = user;
        this.name = name;
        this.audioUrl = audioUrl;
        this.description = description;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
        this.fileSize = file.getSize();
        this.audioFormat = extension;
    }
}
