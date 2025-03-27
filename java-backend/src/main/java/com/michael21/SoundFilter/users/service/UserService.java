package com.michael21.SoundFilter.users.service;

import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.VerificationCode;
import com.michael21.SoundFilter.users.data.CreateUserRequest;
import com.michael21.SoundFilter.users.data.UserResponse;
import com.michael21.SoundFilter.users.jobs.SendWelcomeEmailJob;
import com.michael21.SoundFilter.users.repository.UserRepository;
import com.michael21.SoundFilter.users.repository.VerificationCodeRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.jobrunr.scheduling.BackgroundJobRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final VerificationCodeRepository verificationCodeRepository;

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
}
