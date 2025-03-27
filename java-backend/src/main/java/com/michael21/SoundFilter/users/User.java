package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.util.ApplicationContextProvider;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.crypto.password.PasswordEncoder;

@Entity
@Getter
@NoArgsConstructor
public class User extends AbstractEntity {
    private String email;
    private String password;
    private String firstName;
    private String lastName;

    private boolean verified = false;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Setter
    @OneToOne(mappedBy = "user")
    private VerificationCode verificationCode;

    public User(CreateUserRequest data){
        PasswordEncoder passwordEncoder = ApplicationContextProvider.bean(PasswordEncoder.class);
        this.email = data.getEmail();
        this.password = passwordEncoder.encode(data.getPassword());
        this.firstName = data.getFirstName();
        this.lastName = data.getLastName();
        this.role = Role.USER;
    }
}
