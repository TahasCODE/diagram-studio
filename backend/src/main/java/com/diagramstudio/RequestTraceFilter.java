package com.diagramstudio;

import java.io.IOException;
import java.util.UUID;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestTraceFilter extends OncePerRequestFilter {
    public static final String ATTRIBUTE = "studio.requestId";
    private static final Logger LOG = LoggerFactory.getLogger(RequestTraceFilter.class);
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String id = UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE,id);
        response.setHeader("X-Request-ID",id);
        long started = System.nanoTime();
        try (var ignored = MDC.putCloseable("requestId",id)) {
            try { chain.doFilter(request,response); }
            finally {
                if (request.getRequestURI().startsWith("/api/")) LOG.atInfo()
                    .addKeyValue("event.action","http.request.completed")
                    .addKeyValue("http.request.method",request.getMethod())
                    .addKeyValue("url.path",request.getRequestURI())
                    .addKeyValue("http.response.status_code",response.getStatus())
                    .addKeyValue("duration_ms",(System.nanoTime()-started)/1_000_000.0)
                    .log("API request completed");
            }
        }
    }
}
