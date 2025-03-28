package com.michael21.SoundFilter.auth;

import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.util.exception.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import java.util.Optional;

@Slf4j
public class SecurityUtil {
    private static final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    /*
     * @throws com.michael21.SoundFilter.util.exception.ApiException
     */
    public static User getAuthenticatedUser(){
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        if(principal instanceof User user){
            return user;
        } else {
            log.error("User requested but not found in SecurityContextHolder");
            throw ApiException.builder().status(HttpServletResponse.SC_UNAUTHORIZED).message("Authentication Required").build();
        }
    }

    public static Optional<User> getOptionalAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        if(principal instanceof User user){
            return Optional.of(user);
        } else {
            return Optional.empty();
        }
    }
}
