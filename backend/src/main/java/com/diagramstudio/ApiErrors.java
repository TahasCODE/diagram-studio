package com.diagramstudio;

import java.io.IOException;
import java.util.Map;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.stereotype.Component;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
    private static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(ApiErrors.class);
    private ResponseEntity<?> problem(jakarta.servlet.http.HttpServletRequest request,int status,String detail) {
        return ResponseEntity.status(status).contentType(org.springframework.http.MediaType.parseMediaType("application/problem+json")).body(ProblemResponses.body(request,status,detail));
    }
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> response(ResponseStatusException error,HttpServletRequest request) {
        return problem(request,error.getStatusCode().value(),error.getReason()==null?"Request failed.":error.getReason());
    }
    @ExceptionHandler(BindException.class)
    ResponseEntity<?> fields(BindException error,HttpServletRequest request) {
        var body=ProblemResponses.body(request,400,"Check the submitted fields.");
        body.put("errors",error.getBindingResult().getFieldErrors().stream().map(field->Map.of("field",field.getField(),"message",field.getDefaultMessage()==null?"Invalid value.":field.getDefaultMessage())).toList());
        return ResponseEntity.badRequest().contentType(org.springframework.http.MediaType.parseMediaType("application/problem+json")).body(body);
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,org.springframework.web.bind.ServletRequestBindingException.class})
    ResponseEntity<?> badInput(Exception error,HttpServletRequest request) { return problem(request,400,"Check the submitted fields and diagram format."); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException error,HttpServletRequest request) {
        LOG.error("Database operation failed; requestId={}",request.getAttribute(RequestTraceFilter.ATTRIBUTE),error);
        return problem(request,503,"Project storage is temporarily unavailable. Your local copy is still available.");
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception error,HttpServletRequest request) {
        if(error instanceof org.springframework.web.ErrorResponse response) return problem(request,response.getStatusCode().value(),"The requested operation could not be completed.");
        LOG.error("Unhandled API error; requestId={}",request.getAttribute(RequestTraceFilter.ATTRIBUTE),error);
        return problem(request,500,"An unexpected error occurred. Use the request ID when reporting this problem.");
    }
}

@Component
class ApiBodyLimit extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store");
            if (request.getContentLengthLong() > 1_048_576) {
                ProblemResponses.write(request,response,413,"Project exceeds the 1 MB request limit.");
                return;
            }
            // Apply the same limit to streamed/chunked bodies before JSON deserialization.
            if (java.util.Set.of("POST", "PUT", "PATCH").contains(request.getMethod())) {
                byte[] body = request.getInputStream().readNBytes(1_048_577);
                if (body.length > 1_048_576) {
                    ProblemResponses.write(request,response,413,"Project exceeds the 1 MB request limit.");
                    return;
                }
                var wrapper = new jakarta.servlet.http.HttpServletRequestWrapper(request) {
                    @Override public jakarta.servlet.ServletInputStream getInputStream() {
                        var stream = new java.io.ByteArrayInputStream(body);
                        return new jakarta.servlet.ServletInputStream() {
                            @Override public int read() { return stream.read(); }
                            @Override public boolean isFinished() { return stream.available() == 0; }
                            @Override public boolean isReady() { return true; }
                            @Override public void setReadListener(jakarta.servlet.ReadListener listener) { throw new UnsupportedOperationException(); }
                        };
                    }
                    @Override public java.io.BufferedReader getReader() { return new java.io.BufferedReader(new java.io.InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)); }
                };
                chain.doFilter(wrapper, response);
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
