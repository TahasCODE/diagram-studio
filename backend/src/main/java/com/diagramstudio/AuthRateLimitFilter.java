package com.diagramstudio;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Set;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(-110)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private final FixedWindowRateLimiter limiter;
    private final MeterRegistry meters;
    public AuthRateLimitFilter(@Value("${studio.auth-rate-limit.max-attempts:30}") int attempts,
                              @Value("${studio.auth-rate-limit.window:PT15M}") Duration window, MeterRegistry meters) {
        this.limiter=new FixedWindowRateLimiter(attempts,window,10_000,Clock.systemUTC());this.meters=meters;
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if("POST".equals(request.getMethod()) && Set.of("/api/auth/login","/api/auth/register").contains(request.getRequestURI())) {
            var decision=limiter.acquire(request.getRemoteAddr());
            if(!decision.allowed()) {
                response.setHeader("Retry-After",Long.toString(decision.retryAfterSeconds()));
                meters.counter("studio.auth.rate.limited").increment();
                ProblemResponses.write(request,response,429,"Too many sign-in attempts. Wait before trying again.");
                return;
            }
        }
        chain.doFilter(request,response);
    }
}
