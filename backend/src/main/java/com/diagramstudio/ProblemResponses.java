package com.diagramstudio;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

public final class ProblemResponses {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private ProblemResponses() {}
    public static Map<String,Object> body(HttpServletRequest request, int status, String detail) {
        Map<String,Object> problem = new LinkedHashMap<>();
        HttpStatus known = HttpStatus.resolve(status);
        problem.put("type", "about:blank");
        problem.put("title", known == null ? "Request failed" : known.getReasonPhrase());
        problem.put("status", status);
        problem.put("detail", detail);
        problem.put("message", detail); // Existing clients remain compatible.
        problem.put("instance", request.getRequestURI());
        problem.put("requestId", String.valueOf(request.getAttribute(RequestTraceFilter.ATTRIBUTE)));
        problem.put("timestamp", Instant.now().toString());
        return problem;
    }
    public static void write(HttpServletRequest request, HttpServletResponse response, int status, String detail) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write(JSON.writeValueAsString(body(request,status,detail)));
    }
}
