package com.michael21.SoundFilter.users.jobs.handlers;

import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.email.EmailService;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.VerificationCode;
import com.michael21.SoundFilter.users.jobs.SendWelcomeEmailJob;
import com.michael21.SoundFilter.users.repository.UserRepository;
import com.michael21.SoundFilter.users.repository.VerificationCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jobrunr.jobs.lambdas.JobRequestHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class SendWelcomeEmailJobHandler implements JobRequestHandler<SendWelcomeEmailJob> {
    private final UserRepository userRepository;
    private final VerificationCodeRepository verificationCodeRepository;
    private final SpringTemplateEngine templateEngine;
    private final EmailService emailService;
    private final ApplicationProperties applicationProperties;

    @Override
    @Transactional
    public void run(SendWelcomeEmailJob job) throws Exception {
        User user = userRepository.findById(job.getUserId()).orElseThrow(() -> new RuntimeException("User not found"));
        log.info("Sending welcome email to user with id: {}", job.getUserId());
        if (user.getVerificationCode() != null && !user.getVerificationCode().isEmailSent()) {
            sendWelcomeEmail(user, user.getVerificationCode());
        }
    }

    private void sendWelcomeEmail(User user, VerificationCode code) {
        String verificationLink = applicationProperties.getBaseUrl() + "/auth/verify-email/token=" + code.getCode();
        Context thymeleafContext = new Context();

        thymeleafContext.setVariable("user", user);
        thymeleafContext.setVariable("verificationLink", verificationLink);
        thymeleafContext.setVariable("applicationName", applicationProperties.getApplicationName());

        String htmlBody = templateEngine.process("welcomeEmail", thymeleafContext);

        emailService.sendHtmlMessage(List.of(user.getEmail()), "Welcome to our platform", htmlBody);

        code.setEmailSent(true);

        verificationCodeRepository.save(code);
    }
}
