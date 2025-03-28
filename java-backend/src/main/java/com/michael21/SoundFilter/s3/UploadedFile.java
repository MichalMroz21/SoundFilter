package com.michael21.SoundFilter.s3;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.User;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import net.minidev.json.annotate.JsonIgnore;
import org.apache.commons.io.FilenameUtils;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor
public class UploadedFile extends AbstractEntity {
    private String url;
    private Long size;
    private String originalFileName;
    private String extension;

    @CreationTimestamp
    private LocalDateTime createdAt;
    private LocalDateTime uploadedAt;

    @ManyToOne
    @JsonIgnore
    private User user;

    public UploadedFile(String originalFileName, Long size, User user) {
        this.originalFileName = originalFileName;
        this.size = size;
        this.user = user;
        this.extension = FilenameUtils.getExtension(originalFileName);
    }

    public void onUploaded(String url){
        this.url = url;
        this.createdAt = LocalDateTime.now();
    }

    public String buildPath(String ...path){
        StringBuilder sb = new StringBuilder();
        sb.append("user:").append(user.getId()).append("/");

        for (String p : path){
            sb.append(p).append("/");
        }

        sb.append(UUID.randomUUID());
        sb.append(".").append(extension);

        return sb.toString();
    }
}
