package com.michael21.SoundFilter.auth;

import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.UserConnectedAccount;
import com.michael21.SoundFilter.users.repository.ConnectedAccountRepository;
import com.michael21.SoundFilter.users.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.Optional;

@Component
@Slf4j
public class Oauth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final ConnectedAccountRepository connectedAccountRepository;
    private final ApplicationProperties applicationProperties;
    private final UserRepository userRepository;

    public Oauth2LoginSuccessHandler(ApplicationProperties applicationProperties,
                                     UserRepository userRepository,
                                     ConnectedAccountRepository connectedAccountRepository) {
        this.applicationProperties = applicationProperties;
        this.userRepository = userRepository;
        this.connectedAccountRepository = connectedAccountRepository;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2AuthenticationToken authenticationToken = (OAuth2AuthenticationToken) authentication;
        String provider = authenticationToken.getAuthorizedClientRegistrationId();
        String providerId = authentication.getName();
        String email = authenticationToken.getPrincipal().getAttribute("email");

        Optional<UserConnectedAccount> connectedAccount = connectedAccountRepository.findByProviderAndProviderId(provider, providerId);
        if (connectedAccount.isPresent()) {
            authenticateUser(connectedAccount.get().getUser(), response);
            return;
        }

        User existingUser = userRepository.findByEmail(email).orElse(null);

        if (existingUser != null) {
            UserConnectedAccount newConnectedAccount = new UserConnectedAccount(provider, providerId, existingUser);
            existingUser.addConnectedAccount(newConnectedAccount);
            existingUser = userRepository.save(existingUser);
            connectedAccountRepository.save(newConnectedAccount);
            authenticateUser(existingUser, response);
        } else {
            User newUser = createUserFromOauth2User(authenticationToken);
            authenticateUser(newUser, response);
        }
    }

    private void authenticateUser(User user, HttpServletResponse response) throws IOException {
        UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(token);
        response.sendRedirect(applicationProperties.getLoginSuccessUrl());
    }

    private User createUserFromOauth2User(OAuth2AuthenticationToken authentication) {
        User user = new User(authentication.getPrincipal());
        String provider = authentication.getAuthorizedClientRegistrationId();
        String providerId = authentication.getName();
        UserConnectedAccount connectedAccount = new UserConnectedAccount(provider, providerId, user);
        user.addConnectedAccount(connectedAccount);
        user = userRepository.save(user);
        connectedAccountRepository.save(connectedAccount);
        return user;
    }
}
