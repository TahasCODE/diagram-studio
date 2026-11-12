package com.diagramstudio;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailVerification {
    private final JdbcTemplate jdbc;
    private final AccountCodes codes;
    public EmailVerification(JdbcTemplate jdbc, AccountCodes codes) { this.jdbc=jdbc; this.codes=codes; }
    @Transactional
    public boolean verify(String email, String code) {
        var ids=jdbc.queryForList("SELECT id FROM app_users WHERE email=? AND email_verified_at IS NULL FOR UPDATE", UUID.class, email);
        if(ids.isEmpty() || !codes.consume(ids.getFirst(),"VERIFY_EMAIL",code)) return false;
        jdbc.update("UPDATE app_users SET email_verified_at=now() WHERE id=?",ids.getFirst());
        return true;
    }
    @Transactional
    public void resend(String email) {
        var ids=jdbc.queryForList("SELECT id FROM app_users WHERE email=? AND email_verified_at IS NULL FOR UPDATE",UUID.class,email);
        if(!ids.isEmpty()) codes.issue(ids.getFirst(),email,"VERIFY_EMAIL");
    }
}
