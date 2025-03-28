package com.michael21.SoundFilter.util.exception;

import lombok.Builder;
import lombok.Getter;
import java.util.Map;

@Getter
@Builder
public class ApiException extends RuntimeException {
    private String message;
    private int status = 400;
    private Map<String, String> errors;
}
