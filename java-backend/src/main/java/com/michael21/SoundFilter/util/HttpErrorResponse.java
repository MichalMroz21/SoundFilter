package com.michael21.SoundFilter.util;

import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class HttpErrorResponse {
    private String message;
    private int status;
    private Map<String, String> errors;
    private List<String> generalErrors;

    public static HttpErrorResponse of(String message, int status, Map<String, String> errors, List<String> generalErrors) {
        HttpErrorResponse errorResponse = new HttpErrorResponse();
        errorResponse.message = message;
        errorResponse.status = status;
        errorResponse.errors = errors;
        errorResponse.generalErrors = generalErrors;
        return errorResponse;
    }

    public static HttpErrorResponse of(String message, int status){
        HttpErrorResponse errorResponse = new HttpErrorResponse();
        errorResponse.message = message;
        errorResponse.status = status;
        return errorResponse;
    }
}
