package com.diagramstudio;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordRecovery {
    private final JdbcTemplate jdbc;
    private final AccountCodes codes;
    private final AccountSecurity security;
    public PasswordRecovery(JdbcTemplate jdbc,AccountCodes codes,AccountSecurity security){this.jdbc=jdbc;this.codes=codes;this.security=security;}
    @Transactional
    public void request(String email){
        var ids=jdbc.queryForList("SELECT id FROM app_users WHERE email=? AND email_verified_at IS NOT NULL FOR UPDATE",UUID.class,email);
        if(!ids.isEmpty())codes.issue(ids.getFirst(),email,"RESET_PASSWORD");
    }
    @Transactional
    public boolean reset(String email,String code,String password){
        AccountSecurity.validatePassword(password);
        var ids=jdbc.queryForList("SELECT id FROM app_users WHERE email=? AND email_verified_at IS NOT NULL FOR UPDATE",UUID.class,email);
        if(ids.isEmpty() || !codes.consume(ids.getFirst(),"RESET_PASSWORD",code))return false;
        security.replacePassword(ids.getFirst(),password,"PASSWORD_RESET");
        return true;
    }
}
