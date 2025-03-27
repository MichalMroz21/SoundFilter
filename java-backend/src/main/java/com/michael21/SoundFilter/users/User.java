package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.util.ApplicationContextProvider;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Getter;
import lombok.NoArgsConstructor;
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

    public User(CreateUserRequest data){
        PasswordEncoder passwordEncoder = ApplicationContextProvider.bean(PasswordEncoder.class);
        this.email = data.getEmail();
        this.password = passwordEncoder.encode(data.getPassword());
        this.firstName = data.getFirstName();
        this.lastName = data.getLastName();
        this.role = Role.USER;
    }
}
