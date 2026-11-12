package com.diagramstudio;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

@Configuration
public class SecurityConfiguration {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean org.springframework.security.core.userdetails.UserDetailsService operatorAccounts(
        @org.springframework.beans.factory.annotation.Value("${studio.ops.username:metrics}") String operator,
        @org.springframework.beans.factory.annotation.Value("${studio.ops.password:}") String password,PasswordEncoder encoder) {
        String hash=password.isBlank()?"":encoder.encode(password);
        return username -> {
            if(hash.isBlank() || !operator.equals(username)) throw new org.springframework.security.core.userdetails.UsernameNotFoundException("Operator access is not configured.");
            return org.springframework.security.core.userdetails.User.withUsername(operator).password(hash).roles("OPERATOR").build();
        };
    }
    @Bean HttpSessionSecurityContextRepository contextRepository() { return new HttpSessionSecurityContextRepository(); }

    @Bean
    @org.springframework.core.annotation.Order(1)
    SecurityFilterChain management(HttpSecurity http) throws Exception {
        return http.securityMatcher("/actuator/**")
            .sessionManagement(session->session.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
            .requestCache(cache->cache.disable())
            .authorizeHttpRequests(auth->auth.requestMatchers("/actuator/health","/actuator/health/**").permitAll().anyRequest().hasRole("OPERATOR"))
            .httpBasic(basic->basic.authenticationEntryPoint((request,response,error)-> {
                response.setHeader("WWW-Authenticate","Basic realm=\"Diagram Studio Operations\"");
                ProblemResponses.write(request,response,401,"Operator credentials are required.");
            }))
            .exceptionHandling(errors->errors.accessDeniedHandler((request,response,error)->ProblemResponses.write(request,response,403,"Operator access is required.")))
            .build();
    }
    @Bean
    @org.springframework.core.annotation.Order(2)
    SecurityFilterChain security(HttpSecurity http, HttpSessionSecurityContextRepository repository) throws Exception {
        return http
            .securityContext(context -> context.securityContextRepository(repository))
            .csrf(csrf -> csrf.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/me", "/api/auth/login", "/api/auth/register", "/api/health").permitAll()
                .requestMatchers("/api/auth/verify-email", "/api/auth/resend-verification").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/openapi.json","/api/docs").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/publications/*").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> {
                    ProblemResponses.write(request,response,401,"Sign in to access your projects.");
                })
                .accessDeniedHandler((request, response, error) -> {
                    ProblemResponses.write(request,response,403,"Your session needs refreshing. Reload and try again.");
                }))
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'")))
            .build();
    }
}
