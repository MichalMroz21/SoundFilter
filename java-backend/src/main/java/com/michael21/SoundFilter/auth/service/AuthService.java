package com.michael21.SoundFilter.auth.service;

import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.auth.data.LoginRequest;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.users.repository.UserRepository;
import org.springframework.security.core.AuthenticationException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
    SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    @PersistenceContext
    private EntityManager entityManager;

    public void login(HttpServletRequest request,
                      HttpServletResponse response,
                      LoginRequest body) throws AuthenticationException {
        UsernamePasswordAuthenticationToken token = UsernamePasswordAuthenticationToken.unauthenticated(body.getEmail(), body.getPassword());
        Authentication authentication = authenticationManager.authenticate(token);
        SecurityContextHolderStrategy securityContextHolderStrategy = SecurityContextHolder.getContextHolderStrategy();
        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    @Transactional(readOnly = true)
    public UserResponse getSession(HttpServletRequest request) {
        entityManager.clear();

        User user = SecurityUtil.getAuthenticatedUser();

        user = userRepository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        log.debug("User has {} audio projects",
                user.getAudioProjects() != null ? user.getAudioProjects().size() : 0);

        return new UserResponse(user);
    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        this.logoutHandler.logout(request, response, auth);
    }
}