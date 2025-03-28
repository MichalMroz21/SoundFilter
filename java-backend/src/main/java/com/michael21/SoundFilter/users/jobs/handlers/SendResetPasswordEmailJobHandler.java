package com.michael21.SoundFilter.users.jobs.handlers;

import com.michael21.SoundFilter.config.ApplicationProperties;
import com.michael21.SoundFilter.email.EmailService;
import com.michael21.SoundFilter.entity.AbstractEntity;
import com.michael21.SoundFilter.users.PasswordResetToken;
import com.michael21.SoundFilter.users.User;
import com.michael21.SoundFilter.users.jobs.SendResetPasswordEmailJob;
import com.michael21.SoundFilter.users.repository.PasswordResetTokenRepository;
import lombok.RequiredArgsConstructor;
import org.jobrunr.jobs.lambdas.JobRequestHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SendResetPasswordEmailJobHandler implements JobRequestHandler<SendResetPasswordEmailJob> {
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final ApplicationProperties applicationProperties;
    private final SpringTemplateEngine templateEngine;

    @Override
    @Transactional
    public void run(SendResetPasswordEmailJob sendResetPasswordEmailJob) throws Exception {
        PasswordResetToken resetToken = passwordResetTokenRepository.findById(sendResetPasswordEmailJob.getTokenId())
                .orElseThrow(() -> new IllegalArgumentException("Token not found"));
        if (!resetToken.isEmailSent()) {
            sendResetPasswordEmail(resetToken.getUser(), resetToken);
        }
    }

    private void sendResetPasswordEmail(User user, PasswordResetToken resetToken) {
        String link = applicationProperties.getBaseUrl() + "/auth/reset-password?token=" + resetToken.getToken();
        Context thymeleafContext = new Context();
        thymeleafContext.setVariable("user", user);
        thymeleafContext.setVariable("link", link);
        String htmlBody = templateEngine.process("password-reset", thymeleafContext);
        emailService.sendHtmlMessage(List.of(user.getEmail()), "Password reset requested", htmlBody);
        resetToken.onEmailSent();
        passwordResetTokenRepository.save(resetToken);
    }
}
