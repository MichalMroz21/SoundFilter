package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.entity.AbstractEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.security.authentication.AbstractAuthenticationToken;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
public class UserConnectedAccount extends AbstractEntity {
    private String provider;
    private String providerId;
    private LocalDateTime connectedAt;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    public UserConnectedAccount(String provider, String providerId, User user) {
        this.provider = provider;
        this.providerId = providerId;
        this.user = user;
        connectedAt = LocalDateTime.now();
    }
}
