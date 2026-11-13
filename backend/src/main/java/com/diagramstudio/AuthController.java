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
    private record Credential(Account account, String hash, long version) {}
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final HttpSessionSecurityContextRepository contexts;
    private final AccountCodes codes;
    private final EmailVerification verification;
    private final AccountSecurity security;

    public AuthController(JdbcTemplate jdbc, PasswordEncoder passwords, HttpSessionSecurityContextRepository contexts, AccountCodes codes, EmailVerification verification, AccountSecurity security) {
        this.jdbc = jdbc; this.passwords = passwords; this.contexts = contexts;
        this.codes=codes; this.verification=verification;
        this.security=security;
    }

    @GetMapping("/me")
    Session me(Authentication auth, CsrfToken csrf) {
        Account account = auth == null ? null : jdbc.query("SELECT id,name,email FROM app_users WHERE id=?",
            (rs, row) -> new Account(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email")),
            UUID.fromString(auth.getName())).stream().findFirst().orElse(null);
        return new Session(account, csrf.getToken());
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    @org.springframework.transaction.annotation.Transactional
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
        codes.issue(account.id(),account.email(),"VERIFY_EMAIL");
        return account;
    }

    public record EmailRequest(@NotBlank @Email @Size(max=254) String email) {}
    public record VerifyCode(@NotBlank @Email @Size(max=254) String email,
                             @jakarta.validation.constraints.Pattern(regexp="[0-9]{6}") @NotBlank String code) {
        @Override public String toString() {return "VerifyCode[credentials=REDACTED]";}
    }
    @PostMapping("/verify-email") @ResponseStatus(HttpStatus.NO_CONTENT)
    void verifyEmail(@Valid @RequestBody VerifyCode form) {
        if(!verification.verify(form.email().trim().toLowerCase(Locale.ROOT),form.code()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The code is invalid or expired. Request a new code if needed.");
    }
    @PostMapping("/resend-verification")
    Map<String,String> resend(@Valid @RequestBody EmailRequest form) {
        verification.resend(form.email().trim().toLowerCase(Locale.ROOT));
        return Map.of("message","If this account needs verification, a code has been sent. Check your inbox and spam folder.");
    }

    @PostMapping("/login")
    Account login(@Valid @RequestBody Login form, HttpServletRequest request, HttpServletResponse response) {
        if (form.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        List<Credential> credentials = jdbc.query("SELECT id,name,email,password_hash,auth_version FROM app_users WHERE email=?",
            (rs, row) -> new Credential(new Account(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email")), rs.getString("password_hash"),rs.getLong("auth_version")),
            form.email().trim().toLowerCase(Locale.ROOT));
        // Run a bcrypt comparison even for unknown accounts to reduce account enumeration by timing.
        String hash = credentials.isEmpty() ? "$2a$10$7EqJtq98hPqEX7fNZaFWoO5uB2Ji2qJrDq5OqF9dZH3Fq9O9Q8T2u" : credentials.getFirst().hash();
        boolean matches = passwords.matches(form.password(), hash);
        if (credentials.isEmpty() || !matches) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        Account account = credentials.getFirst().account();
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT email_verified_at IS NOT NULL FROM app_users WHERE id=?",Boolean.class,account.id())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Verify your email before signing in. Request a verification code to continue.");
        authenticate(account,credentials.getFirst().version(), request, response);
        return account;
    }

    private void authenticate(Account account,long version, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) request.changeSessionId();
        var authorities=List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("SESSION_VERSION_"+version));
        var principal = new User(account.id().toString(), "", authorities);
        var auth = UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }

    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        new SecurityContextLogoutHandler().logout(request, response, auth);
    }

    public record ChangePassword(@NotBlank @Size(max=72) String currentPassword,
                                 @NotBlank @Size(min=10,max=72) String newPassword) {
        @Override public String toString(){return "ChangePassword[credentials=REDACTED]";}
    }
    public record Profile(@NotBlank @Size(max=80) String name) {}
    @PostMapping("/change-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@Valid @RequestBody ChangePassword form,Authentication auth,HttpServletRequest request,HttpServletResponse response){
        security.changePassword(UUID.fromString(auth.getName()),form.currentPassword(),form.newPassword());
        logout(request,response,auth);
    }
    @PutMapping("/profile")
    Account profile(@Valid @RequestBody Profile form,Authentication auth){
        UUID id=UUID.fromString(auth.getName());security.changeName(id,form.name());
        return jdbc.queryForObject("SELECT id,name,email FROM app_users WHERE id=?",(rs,row)->new Account(id,rs.getString("name"),rs.getString("email")),id);
    }
    @GetMapping("/security-events")
    List<Map<String,Object>> securityEvents(Authentication auth){
        return jdbc.query("SELECT action,created_at FROM account_security_events WHERE owner_id=? ORDER BY id DESC LIMIT 20",
            (rs,row)->Map.<String,Object>of("action",rs.getString("action"),"createdAt",rs.getTimestamp("created_at").toInstant()),UUID.fromString(auth.getName()));
    }
    @PostMapping("/logout-all") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logoutAll(Authentication auth,HttpServletRequest request,HttpServletResponse response){
        security.signOutEverywhere(UUID.fromString(auth.getName()));logout(request,response,auth);
    }
}
