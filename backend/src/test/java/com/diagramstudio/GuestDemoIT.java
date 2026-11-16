package com.diagramstudio;

import java.net.*;
import java.net.http.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=${STUDIO_TEST_DB_URL:jdbc:postgresql://localhost:55432/diagram_studio_test}",
    "management.server.port=0","studio.accounts.enabled=false","spring.mail.port=9"
})
class GuestDemoIT {
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Test void exposesGuestCapabilitiesButRejectsAccountAndDraftActionsBeforeControllers() throws Exception {
        long users=jdbc.queryForObject("SELECT count(*) FROM app_users",Long.class);
        var http=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
        String base="http://127.0.0.1:"+environment.getProperty("local.server.port");
        var me=http.send(HttpRequest.newBuilder(URI.create(base+"/api/auth/me")).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,me.statusCode());var session=json.readTree(me.body());assertFalse(session.path("accountsEnabled").asBoolean());assertTrue(session.path("user").isNull());
        for(String path:new String[]{"register","login","forgot-password","resend-verification","verify-email","reset-password","change-password","logout"}){
            var request=HttpRequest.newBuilder(URI.create(base+"/api/auth/"+path)).header("Content-Type","application/json").header("X-CSRF-TOKEN",session.path("csrfToken").asText())
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email","guest@example.test","password","TestPassword123","name","Guest")))).build();
            int status=http.send(request,HttpResponse.BodyHandlers.ofString()).statusCode();assertTrue(status==401||status==403,path+" must be unavailable");
        }
        assertEquals(401,http.send(HttpRequest.newBuilder(URI.create(base+"/api/projects")).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(users,jdbc.queryForObject("SELECT count(*) FROM app_users",Long.class));
    }
}
