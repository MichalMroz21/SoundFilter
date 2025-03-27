package com.michael21.SoundFilter.users.data;

import com.michael21.SoundFilter.util.validators.PasswordMatch;
import com.michael21.SoundFilter.util.validators.Unique;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

@Data
@PasswordMatch(passwordField = "password", passwordConfirmationField = "passwordConfirmation")
public class CreateUserRequest {
    @Email
    @Unique(columnName = "email", tableName = "user", message = "User with this email already exists")
    private String email;
    @NotNull
    @Length(min = 8)
    @Pattern(regexp="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$", message = "Must contain at least one uppercase letter, one lowercase letter, and one digit.")
    private String password;
    private String passwordConfirmation;
    private String firstName;
    private String lastName;
}
