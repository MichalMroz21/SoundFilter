package com.michael21.SoundFilter.util.validators;


import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.lang.reflect.Field;

public class PasswordMatchValidator implements ConstraintValidator<PasswordMatch, Object> {
    private String passwordFieldName;
    private String passwordConfirmationFieldName;

    @Override
    public void initialize(PasswordMatch constraintAnnotation) {
        passwordFieldName = constraintAnnotation.passwordField();
        passwordConfirmationFieldName = constraintAnnotation.passwordConfirmationField();
    }

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context){
        try {
            Class<?> clazz = value.getClass();
            Field passwordField = clazz.getDeclaredField(passwordFieldName);
            Field passwordMatchField = clazz.getDeclaredField(passwordConfirmationFieldName);

            passwordField.setAccessible(true);
            passwordMatchField.setAccessible(true);

            String password = (String) passwordField.get(value);
            String passwordMatch = (String) passwordMatchField.get(value);

            return password != null && password.equals(passwordMatch);

        } catch (NoSuchFieldException | IllegalAccessException e) {
            e.printStackTrace();
            return false;
        }
    }

}
