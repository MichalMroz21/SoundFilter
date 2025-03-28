package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.users.data.UpdateUserRequest;
import com.michael21.SoundFilter.util.ApplicationContextProvider;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collection;
import java.util.Collections;

@Entity
@Getter
@NoArgsConstructor
public class User extends AbstractEntity implements UserDetails {
    private String email;
    private String password;
    private String firstName;
    private String lastName;

    @Setter
    private boolean verified = false;

    @Enumerated(EnumType.STRING)
    @Setter
    private Role role;

    @Setter
    @OneToOne(mappedBy = "user")
    private VerificationCode verificationCode;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singleton(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getUsername() { return email; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override  //change to return verified if user cant login before verifying email
    public boolean isEnabled() { return verified; }

    public void updatePassword(String password) {
        PasswordEncoder encoder = ApplicationContextProvider.bean(PasswordEncoder.class);
        this.password = encoder.encode(password);
    }

    public void update(UpdateUserRequest request) {
        this.firstName = request.getFirstName();
        this.lastName = request.getLastName();
    }

    public User(CreateUserRequest data){
        PasswordEncoder passwordEncoder = ApplicationContextProvider.bean(PasswordEncoder.class);
        this.email = data.getEmail();
        this.password = passwordEncoder.encode(data.getPassword());
        this.firstName = data.getFirstName();
        this.lastName = data.getLastName();
        this.role = Role.USER;
    }
}
