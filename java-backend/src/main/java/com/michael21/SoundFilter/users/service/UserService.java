package com.michael21.SoundFilter.users.service;

import com.michael21.SoundFilter.auth.SecurityUtil;
import com.michael21.SoundFilter.users.PasswordResetToken;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.VerificationCode;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.users.data.UpdateUserPasswordRequest;
import com.michael21.SoundFilter.users.data.UpdateUserRequest;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.users.jobs.SendResetPasswordEmailJob;
import com.michael21.SoundFilter.users.jobs.SendWelcomeEmailJob;
import com.michael21.SoundFilter.users.repository.PasswordResetTokenRepository;
import com.michael21.SoundFilter.users.repository.UserRepository;
import com.michael21.SoundFilter.users.repository.VerificationCodeRepository;
import com.michael21.SoundFilter.util.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jobrunr.scheduling.BackgroundJobRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final VerificationCodeRepository verificationCodeRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserResponse create(@Valid CreateUserRequest request) {
        User user = new User(request);
        user = userRepository.save(user);

        sendVerificationEmail(user);

        return new UserResponse(user);
    }

    private void sendVerificationEmail(User user) {
        VerificationCode verificationCode = new VerificationCode(user);
        user.setVerificationCode(verificationCode);
        verificationCodeRepository.save(verificationCode);
        SendWelcomeEmailJob sendWelcomeEmailJob = new SendWelcomeEmailJob(user.getId());
        BackgroundJobRequest.enqueue(sendWelcomeEmailJob);
    }

    @Transactional
    public void verifyEmail(String code){
        VerificationCode verificationCode = verificationCodeRepository.findByCode(code)
                .orElseThrow(() -> ApiException.builder().status(HttpServletResponse.SC_BAD_REQUEST).message("Invalid verification code").build());
        User user = verificationCode.getUser();

        user.setVerified(true);
        userRepository.save(user); //update user information in db

        verificationCodeRepository.delete(verificationCode);
    }

    @Transactional
    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.builder().status(HttpServletResponse.SC_NOT_FOUND).message("User not found").build());

        PasswordResetToken passwordResetToken = new PasswordResetToken(user);
        passwordResetTokenRepository.save(passwordResetToken);
        SendResetPasswordEmailJob sendResetPasswordEmailJob = new SendResetPasswordEmailJob(passwordResetToken.getId());
        BackgroundJobRequest.enqueue(sendResetPasswordEmailJob);
    }

    @Transactional
    public void resetPassword(UpdateUserPasswordRequest request) {
        PasswordResetToken passwordResetToken = passwordResetTokenRepository.findByToken(request.getPasswordResetToken())
                .orElseThrow(() -> ApiException.builder().status(HttpServletResponse.SC_NOT_FOUND).message("Password reset token not found").build());

        if (passwordResetToken.isExpired()) {
            throw ApiException.builder().status(HttpServletResponse.SC_BAD_REQUEST).message("Password reset token has expired").build();
        }

        User user = passwordResetToken.getUser();
        user.updatePassword(request.getPassword());
        userRepository.save(user); //update user in db
    }

    @Transactional
    public UserResponse update(UpdateUserRequest request) {
        User user = SecurityUtil.getAuthenticatedUser();
        user = userRepository.getReferenceById(user.getId());
        user.update(request);
        user = userRepository.save(user);
        return new UserResponse(user);
    }

    @Transactional
    public UserResponse updatePassword(UpdateUserPasswordRequest request) {
        User user = SecurityUtil.getAuthenticatedUser();
        if(user.getPassword() != null && !passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw ApiException.builder().status(HttpServletResponse.SC_BAD_REQUEST).message("Wrong Password").build();
        }

        user.updatePassword(request.getPassword());
        user = userRepository.save(user);
        return new UserResponse(user);
    }
}
