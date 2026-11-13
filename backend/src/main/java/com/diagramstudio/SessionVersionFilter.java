package com.diagramstudio;

import java.io.IOException;
import java.util.UUID;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

// Installed only in the application security chain, after loading the session context.
public class SessionVersionFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;
    public SessionVersionFilter(JdbcTemplate jdbc) {this.jdbc=jdbc;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(request.getRequestURI().startsWith("/api/") && auth!=null && auth.isAuthenticated()
            && !"anonymousUser".equals(auth.getPrincipal())) {
            boolean valid=false;
            try {
                var versions=jdbc.queryForList("SELECT auth_version FROM app_users WHERE id=? AND email_verified_at IS NOT NULL",Long.class,UUID.fromString(auth.getName()));
                valid=!versions.isEmpty() && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("SESSION_VERSION_"+versions.getFirst()));
            }catch(IllegalArgumentException ignored) {
                // Unknown session principal format is not a valid application account.
            }catch(DataAccessException error) {
                ProblemResponses.write(request,response,503,"Account storage is temporarily unavailable.");return;
            }
            if(!valid){
                SecurityContextHolder.clearContext();
                if(request.getSession(false)!=null)request.getSession(false).invalidate();
                ProblemResponses.write(request,response,401,"Your session has ended. Sign in again.");return;
            }
        }
        chain.doFilter(request,response);
    }
}
