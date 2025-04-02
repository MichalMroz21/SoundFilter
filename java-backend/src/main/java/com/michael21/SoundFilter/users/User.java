package com.michael21.SoundFilter.users;

import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.users.data.UpdateUserRequest;
import com.michael21.SoundFilter.util.ApplicationContextProvider;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

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

    @Setter
    private String profileImageUrl;

    @Enumerated(EnumType.STRING)
    @Setter
    private Role role;

    @Setter
    @OneToOne(mappedBy = "user")
    private VerificationCode verificationCode;

    @OneToMany(mappedBy = "user", fetch = FetchType.EAGER)
    private List<UserConnectedAccount> connectedAccounts = new ArrayList<>();

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

    public User (OAuth2User oAuth2User) {
        User user = new User();
        user.email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        if (name != null) {
            List<String> names = List.of(name.split(" "));
            if (names.size() > 1) {
                user.firstName = names.get(0);
                user.lastName = names.get(1);
            } else {
                user.firstName = names.getFirst();
            }
        }
        user.verified = true;
        user.role = Role.USER;
    }

    public void addConnectedAccount(UserConnectedAccount connectedAccount) {
        connectedAccounts.add(connectedAccount);
    }
}
