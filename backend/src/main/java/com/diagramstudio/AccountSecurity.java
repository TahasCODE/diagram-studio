package com.diagramstudio;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountSecurity {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    public AccountSecurity(JdbcTemplate jdbc,PasswordEncoder passwords){this.jdbc=jdbc;this.passwords=passwords;}
    public static void validatePassword(String password){
        if(password.getBytes(StandardCharsets.UTF_8).length>72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at most 72 UTF-8 bytes.");
    }
    @Transactional
    public void changePassword(UUID owner,String current,String next){
        validatePassword(next);
        var hash=jdbc.queryForObject("SELECT password_hash FROM app_users WHERE id=? FOR UPDATE",String.class,owner);
        if(current.getBytes(StandardCharsets.UTF_8).length>72 || !passwords.matches(current,hash))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Current password is incorrect.");
        if(passwords.matches(next,hash))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a different new password.");
        replacePassword(owner,next,"PASSWORD_CHANGED");
    }
    // Caller owns the account lock and transaction; also used by password recovery.
    void replacePassword(UUID owner,String next,String action){
        jdbc.update("UPDATE app_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?",passwords.encode(next),owner);
        jdbc.update("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME=?",owner.toString());
        jdbc.update("DELETE FROM account_codes WHERE user_id=? AND purpose='RESET_PASSWORD'",owner);
        record(owner,action);
    }
    void record(UUID owner,String action){
        jdbc.update("INSERT INTO account_security_events(owner_id,action,request_id) VALUES (?,?,?)",owner,action,MDC.get("requestId"));
    }
    @Transactional
    public void changeName(UUID owner,String name){
        if(name.trim().isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter your name.");
        jdbc.update("UPDATE app_users SET name=? WHERE id=?",name.trim(),owner);
        record(owner,"PROFILE_UPDATED");
    }
    @Transactional
    public void signOutEverywhere(UUID owner){
        jdbc.update("UPDATE app_users SET auth_version=auth_version+1 WHERE id=?",owner);
        jdbc.update("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME=?",owner.toString());
        record(owner,"SESSIONS_REVOKED");
    }
}
