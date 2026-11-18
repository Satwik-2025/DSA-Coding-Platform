package com.capstone.dsaplatform.error;

import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns exceptions into the contract's error body, so every 400/404 looks the same
 * to the frontend no matter which layer detected the problem. Spring's own errors (unknown path,
 * wrong method, wrong content type) and unexpected crashes get the same { error, message } shape.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    public record ApiError(String error, String message) {
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> notFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiError> badRequest(BadRequestException ex) {
        return badRequest(ex.getMessage());
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ApiError> tooMany(TooManyRequestsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "10")
                .body(new ApiError("TOO_MANY_REQUESTS", ex.getMessage()));
    }

    @ExceptionHandler(ServiceUnavailableException.class)
    public ResponseEntity<ApiError> unavailable(ServiceUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).header("Retry-After", "5")
                .body(new ApiError("SERVICE_UNAVAILABLE", ex.getMessage()));
    }

    // e.g. GET /api/topics/graph without ?userId
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> missingParam(MissingServletRequestParameterException ex) {
        return badRequest("Query parameter '" + ex.getParameterName() + "' is required");
    }

    // e.g. ?difficulty=VERY_HARD or ?limit=abc
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> typeMismatch(MethodArgumentTypeMismatchException ex) {
        return badRequest("Invalid value '" + ex.getValue() + "' for parameter '" + ex.getName() + "'");
    }

    // Missing or malformed JSON body, or a field of the wrong type (e.g. "rating": 2.5 or "topicId": "x").
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof MismatchedInputException m && !m.getPath().isEmpty()) {
            String field = m.getPath().get(m.getPath().size() - 1).getFieldName();
            if (field != null) {
                return badRequest("Field '" + field + "' has a value of the wrong type");
            }
        }
        return badRequest("Request body is missing or is not valid JSON");
    }

    // Everything else. Spring MVC's own errors carry their status (404 unknown path, 405, 415, ...);
    // anything without one is a bug, so it is logged and answered with a generic 500.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> other(Exception ex) {
        if (ex instanceof ErrorResponse er) {
            HttpStatusCode status = er.getStatusCode();
            String message = switch (status.value()) {
                case 404 -> "There is no such API endpoint";
                case 405 -> "This endpoint does not accept that HTTP method";
                case 415 -> "Send the request body as JSON (Content-Type: application/json)";
                default -> er.getBody().getDetail() == null ? "Request failed" : er.getBody().getDetail();
            };
            HttpStatus known = HttpStatus.resolve(status.value());
            return ResponseEntity.status(status).headers(er.getHeaders())
                    .body(new ApiError(known == null ? "ERROR" : known.name(), message));
        }
        log.error("Unexpected error while handling a request", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("INTERNAL_ERROR", "Something went wrong on the server. Please try again."));
    }

    private ResponseEntity<ApiError> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError("BAD_REQUEST", message));
    }
}
