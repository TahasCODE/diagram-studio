package com.diagramstudio;

import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=${STUDIO_TEST_DB_URL:jdbc:postgresql://localhost:55432/diagram_studio_test}",
    "management.server.port=0","studio.auth-rate-limit.max-attempts=200"
})
class EmailVerificationIT {
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired JavaMailSender sender;
    final HttpClient http=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
    String csrf;
    @SuppressWarnings("unchecked")
    Map<String,Object> call(String path,Object body,int expected)throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+environment.getProperty("local.server.port")+"/api/auth/"+path));
        if(body!=null)builder.header("Content-Type","application/json").header("X-CSRF-TOKEN",csrf).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(expected,response.statusCode(),response.body());
        if(expected==204)return Map.of();
        var value=json.readValue(response.body(),Map.class);
        if(value.containsKey("csrfToken"))csrf=(String)value.get("csrfToken");
        return value;
    }
    @SuppressWarnings("unchecked")
    List<Map<String,Object>> mail(String email)throws Exception {
        var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:8025/messages?to="+URLEncoder.encode(email,java.nio.charset.StandardCharsets.UTF_8))).build(),HttpResponse.BodyHandlers.ofString());
        return (List<Map<String,Object>>)(List<?>)json.readValue(response.body(),List.class);
    }
    @Test void codesExpireLockOutResendAndConsumeOnce()throws Exception {
        call("me",null,200);
        String email="verification-"+UUID.randomUUID()+"@example.test";
        var form=Map.of("name","Verification Test","email",email,"password","VerificationPassword123");
        UUID id=null;
        try {
            id=UUID.fromString((String)call("register",form,201).get("id"));
            String first=(String)mail(email).getLast().get("code");
            assertFalse(jdbc.queryForObject("SELECT code_hash FROM account_codes WHERE user_id=?",String.class,id).contains(first));
            call("resend-verification",Map.of("email",email),200);
            assertEquals(1,mail(email).size());
            call("login",Map.of("email",email,"password","VerificationPassword123"),403);
            jdbc.update("UPDATE account_codes SET expires_at=now()-interval '1 second' WHERE user_id=?",id);
            call("verify-email",Map.of("email",email,"code",first),400);
            jdbc.update("UPDATE account_codes SET expires_at=now()+interval '10 minutes' WHERE user_id=?",id);
            String wrong=first.equals("000000")?"111111":"000000";
            for(int i=0;i<5;i++)call("verify-email",Map.of("email",email,"code",wrong),400);
            call("verify-email",Map.of("email",email,"code",first),400);
            assertEquals(5,jdbc.queryForObject("SELECT attempts FROM account_codes WHERE user_id=?",Integer.class,id));
            jdbc.update("UPDATE account_codes SET sent_at=now()-interval '61 seconds' WHERE user_id=?",id);
            call("resend-verification",Map.of("email",email),200);
            assertEquals(2,mail(email).size());
            String latest=(String)mail(email).getLast().get("code");
            call("verify-email",Map.of("email",email,"code",latest),204);
            call("verify-email",Map.of("email",email,"code",latest),400);
            assertNull(call("me",null,200).get("user"));
            call("login",Map.of("email",email,"password","VerificationPassword123"),200);
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM account_codes WHERE user_id=?",Integer.class,id));
            call("logout",Map.of(),204);
        }finally{if(id!=null)jdbc.update("DELETE FROM app_users WHERE id=?",id);}
    }
    @Test void smtpFailureRollsBackRegistration()throws Exception {
        call("me",null,200);
        var smtp=(JavaMailSenderImpl)sender;
        int port=smtp.getPort();
        String email="delivery-failure-"+UUID.randomUUID()+"@example.test";
        try {
            smtp.setPort(1);
            call("register",Map.of("name","Failure Test","email",email,"password","VerificationPassword123"),503);
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM app_users WHERE email=?",Integer.class,email));
        }finally{smtp.setPort(port);}
    }
    @Test void passwordChangeRevokesOtherSessionsAndRejectsStaleCredentialVersions()throws Exception {
        call("me",null,200);
        String email="password-"+UUID.randomUUID()+"@example.test";
        String old="OriginalPassword123",next="ChangedPassword456";
        UUID id=null;
        try{
            id=UUID.fromString((String)call("register",Map.of("name","Password Test","email",email,"password",old),201).get("id"));
            call("verify-email",Map.of("email",email,"code",mail(email).getLast().get("code")),204);
            call("login",Map.of("email",email,"password",old),200);
            var second=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
            String base="http://127.0.0.1:"+environment.getProperty("local.server.port")+"/api";
            var me=second.send(HttpRequest.newBuilder(URI.create(base+"/auth/me")).build(),HttpResponse.BodyHandlers.ofString());
            String token=(String)json.readValue(me.body(),Map.class).get("csrfToken");
            var login=HttpRequest.newBuilder(URI.create(base+"/auth/login")).header("Content-Type","application/json").header("X-CSRF-TOKEN",token)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email",email,"password",old)))).build();
            assertEquals(200,second.send(login,HttpResponse.BodyHandlers.ofString()).statusCode());
            call("change-password",Map.of("currentPassword","IncorrectPassword","newPassword",next),400);
            call("change-password",Map.of("currentPassword",old,"newPassword",old),400);
            call("change-password",Map.of("currentPassword",old,"newPassword","é".repeat(40)),400);
            call("change-password",Map.of("currentPassword",old,"newPassword",next),204);
            assertNull(call("me",null,200).get("user"));
            assertEquals(401,second.send(HttpRequest.newBuilder(URI.create(base+"/projects")).build(),HttpResponse.BodyHandlers.ofString()).statusCode());
            call("login",Map.of("email",email,"password",old),401);
            call("login",Map.of("email",email,"password",next),200);
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_security_events WHERE owner_id=? AND action='PASSWORD_CHANGED'",Integer.class,id));
            // Simulate an old login persisted after password rotation: its session row still exists.
            jdbc.update("UPDATE app_users SET auth_version=auth_version+1 WHERE id=?",id);
            call("me",null,401);
            assertNull(call("me",null,200).get("user"));
            call("login",Map.of("email",email,"password",next),200);
            call("logout-all",Map.of(),204);
            assertNull(call("me",null,200).get("user"));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_security_events WHERE owner_id=? AND action='SESSIONS_REVOKED'",Integer.class,id));
        }finally{if(id!=null)jdbc.update("DELETE FROM app_users WHERE id=?",id);}
    }
}
