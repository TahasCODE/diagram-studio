package com.diagramstudio;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountCodes {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final AccountMail mail;
    private final SecureRandom random = new SecureRandom();
    public AccountCodes(JdbcTemplate jdbc, PasswordEncoder passwords, AccountMail mail) {
        this.jdbc = jdbc; this.passwords = passwords; this.mail = mail;
    }
    @Transactional
    public void issue(UUID userId, String email, String purpose) {
        jdbc.queryForObject("SELECT id FROM app_users WHERE id=? FOR UPDATE", UUID.class, userId);
        var recent = jdbc.queryForList("SELECT user_id FROM account_codes WHERE user_id=? AND purpose=? AND sent_at > now() - interval '60 seconds'", userId, purpose);
        if (!recent.isEmpty()) return;
        String code = String.format(java.util.Locale.ROOT, "%06d", random.nextInt(1_000_000));
        jdbc.update("INSERT INTO account_codes(user_id,purpose,code_hash,expires_at) VALUES (?,?,?,?) ON CONFLICT (user_id,purpose) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,sent_at=now(),attempts=0",
            userId, purpose, passwords.encode(code), Timestamp.from(Instant.now().plusSeconds(600)));
        mail.sendCode(email, code, purpose);
    }
    // Caller holds the account row lock and transaction. False lets failed attempts commit.
    public boolean consume(UUID userId, String purpose, String code) {
        var rows = jdbc.queryForList("SELECT code_hash,expires_at,attempts FROM account_codes WHERE user_id=? AND purpose=? FOR UPDATE", userId, purpose);
        if (rows.isEmpty()) return false;
        var row = rows.getFirst();
        if (((Number)row.get("attempts")).intValue() >= 5 || !((Timestamp)row.get("expires_at")).toInstant().isAfter(Instant.now())) return false;
        jdbc.update("UPDATE account_codes SET attempts=attempts+1 WHERE user_id=? AND purpose=?", userId, purpose);
        if (!passwords.matches(code, (String)row.get("code_hash"))) return false;
        jdbc.update("DELETE FROM account_codes WHERE user_id=? AND purpose=?", userId, purpose);
        return true;
    }
}
