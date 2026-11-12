package com.diagramstudio;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public record Account(UUID id, String name, String email) {}
    public record Register(@NotBlank @Size(max=80) String name,
                           @NotBlank @Email @Size(max=254) String email,
                           @NotBlank @Size(min=10,max=72) String password) {
        @Override public String toString() {return "Register[credentials=REDACTED]";}
    }
    public record Login(@NotBlank @Email @Size(max=254) String email,
                        @NotBlank @Size(max=72) String password) {
        @Override public String toString() {return "Login[credentials=REDACTED]";}
    }
    public record Session(Account user, String csrfToken) {}
    private record Credential(Account account, String hash) {}
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final HttpSessionSecurityContextRepository contexts;

    public AuthController(JdbcTemplate jdbc, PasswordEncoder passwords, HttpSessionSecurityContextRepository contexts) {
        this.jdbc = jdbc; this.passwords = passwords; this.contexts = contexts;
    }

    @GetMapping("/me")
    Session me(Authentication auth, CsrfToken csrf) {
        Account account = auth == null ? null : jdbc.query("SELECT id,name,email FROM app_users WHERE id=?",
            (rs, row) -> new Account(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email")),
            UUID.fromString(auth.getName())).stream().findFirst().orElse(null);
        return new Session(account, csrf.getToken());
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    Account register(@Valid @RequestBody Register form, HttpServletRequest request, HttpServletResponse response) {
        if (form.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at most 72 UTF-8 bytes.");
        Account account = new Account(UUID.randomUUID(), form.name().trim(), form.email().trim().toLowerCase(Locale.ROOT));
        try {
            jdbc.update("INSERT INTO app_users(id,name,email,password_hash) VALUES (?,?,?,?)",
                account.id(), account.name(), account.email(), passwords.encode(form.password()));
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists.");
        }
        return account;
    }

    @PostMapping("/login")
    Account login(@Valid @RequestBody Login form, HttpServletRequest request, HttpServletResponse response) {
        if (form.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        List<Credential> credentials = jdbc.query("SELECT id,name,email,password_hash FROM app_users WHERE email=?",
            (rs, row) -> new Credential(new Account(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email")), rs.getString("password_hash")),
            form.email().trim().toLowerCase(Locale.ROOT));
        // Run a bcrypt comparison even for unknown accounts to reduce account enumeration by timing.
        String hash = credentials.isEmpty() ? "$2a$10$7EqJtq98hPqEX7fNZaFWoO5uB2Ji2qJrDq5OqF9dZH3Fq9O9Q8T2u" : credentials.getFirst().hash();
        boolean matches = passwords.matches(form.password(), hash);
        if (credentials.isEmpty() || !matches) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        Account account = credentials.getFirst().account();
        authenticate(account, request, response);
        return account;
    }

    private void authenticate(Account account, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) request.changeSessionId();
        var principal = new User(account.id().toString(), "", List.of());
        var auth = UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of());
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }

    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        new SecurityContextLogoutHandler().logout(request, response, auth);
    }
}
