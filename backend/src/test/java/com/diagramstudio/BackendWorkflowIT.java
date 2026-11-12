package com.diagramstudio;

import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import io.micrometer.core.instrument.MeterRegistry;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=${STUDIO_TEST_DB_URL:jdbc:postgresql://localhost:55432/diagram_studio_test}",
    "management.server.port=0","studio.auth-rate-limit.max-attempts=8",
    "studio.ops.username=test-operator","studio.ops.password=operator-test-only-123"
})
class BackendWorkflowIT {
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired MeterRegistry meters;
    private UUID owner;
    @AfterEach void cleanFixtures(){if(owner!=null)jdbc.update("DELETE FROM app_users WHERE id=?",owner);}
    class Client {
        final HttpClient http=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
        final String base="http://127.0.0.1:"+environment.getProperty("local.server.port");
        String csrf;
        HttpRequest request(String path,String method,Object body) {
            var builder=HttpRequest.newBuilder(URI.create(base+path)).timeout(java.time.Duration.ofSeconds(15));
            if(csrf!=null)builder.header("X-CSRF-TOKEN",csrf);
            if(body!=null)builder.header("Content-Type","application/json");
            return builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
        }
        @SuppressWarnings("unchecked") Map<String,Object> call(String path,String method,Object body,int status)throws Exception {
            var response=http.send(request(path,method,body),HttpResponse.BodyHandlers.ofString());
            assertEquals(status,response.statusCode(),response.body());
            assertDoesNotThrow(()->UUID.fromString(response.headers().firstValue("X-Request-ID").orElseThrow()));
            if(status==204)return Map.of();
            Map<String,Object> value=json.readValue(response.body(),Map.class);
            if(value.get("csrfToken")!=null)csrf=(String)value.get("csrfToken");
            if(status>=400){assertEquals(status,((Number)value.get("status")).intValue());assertEquals(response.headers().firstValue("X-Request-ID").orElseThrow(),value.get("requestId"));}
            return value;
        }
    }
    @SuppressWarnings("unchecked")
    @Test void realPostgresConcurrencyRollbackAuditMetricsAndRateLimit()throws Exception {
        var client=new Client();client.call("/api/auth/me","GET",null,200);
        String email="java-it-"+UUID.randomUUID()+"@example.test";
        var account=client.call("/api/auth/register","POST",Map.of("name","Java Integration","email",email,"password","IntegrationPassword123"),201);
        owner=UUID.fromString((String)account.get("id"));
        assertNull(client.call("/api/auth/me","GET",null,200).get("user"));
        client.call("/api/auth/login","POST",Map.of("email",email,"password","IntegrationPassword123"),403);
        var mail=client.http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:8025/messages?to="+URLEncoder.encode(email,java.nio.charset.StandardCharsets.UTF_8))).GET().build(),HttpResponse.BodyHandlers.ofString());
        var messages=json.readValue(mail.body(),List.class);
        String code=(String)((Map<?,?>)messages.getLast()).get("code");
        client.call("/api/auth/verify-email","POST",Map.of("email",email,"code",code),204);
        client.call("/api/auth/verify-email","POST",Map.of("email",email,"code",code),400);
        client.call("/api/auth/login","POST",Map.of("email",email,"password","IntegrationPassword123"),200);
        var document=Map.of("title","Concurrency 100%_proof","nodes",List.of(Map.of("id","a","label","Start","x",20,"y",50)),"scenarios",List.of(Map.of("name","Main","steps",List.of("a"))));
        var draft=client.call("/api/projects","POST",Map.of("document",document),201);
        UUID id=UUID.fromString((String)draft.get("id"));
        var first=client.http.sendAsync(client.request("/api/projects/"+id,"PUT",Map.of("version",1,"document",document)),HttpResponse.BodyHandlers.ofString());
        var second=client.http.sendAsync(client.request("/api/projects/"+id,"PUT",Map.of("version",1,"document",document)),HttpResponse.BodyHandlers.ofString());
        assertEquals(List.of(200,409),List.of(first.join().statusCode(),second.join().statusCode()).stream().sorted().toList());
        assertEquals(2,jdbc.queryForObject("SELECT version FROM projects WHERE id=?",Long.class,id));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM project_revisions WHERE project_id=?",Long.class,id));
        long before=jdbc.queryForObject("SELECT count(*) FROM audit_events WHERE project_id=?",Long.class,id);
        double metricBefore=meters.get("studio.project.events").tag("action","PROJECT_UPDATED").counter().count();
        // A fixture-only conflicting revision forces an insert failure after the draft UPDATE.
        jdbc.update("INSERT INTO project_revisions(project_id,version,title,document) SELECT id,version+1,title,document FROM projects WHERE id=?",id);
        client.call("/api/projects/"+id,"PUT",Map.of("version",2,"document",document),503);
        assertEquals(2,jdbc.queryForObject("SELECT version FROM projects WHERE id=?",Long.class,id));
        assertEquals(before,jdbc.queryForObject("SELECT count(*) FROM audit_events WHERE project_id=?",Long.class,id));
        assertEquals(metricBefore,meters.get("studio.project.events").tag("action","PROJECT_UPDATED").counter().count());
        jdbc.update("DELETE FROM project_revisions WHERE project_id=? AND version=3",id);
        var unrelated=new HashMap<String,Object>(document);unrelated.put("title","No special characters");
        client.call("/api/projects","POST",Map.of("document",unrelated),201);
        var literal=client.call("/api/projects?q="+URLEncoder.encode("%_",java.nio.charset.StandardCharsets.UTF_8),"GET",null,200);
        assertEquals(1,((Number)literal.get("total")).intValue());
        var activity=client.call("/api/activity?projectId="+id,"GET",null,200);
        assertEquals(2,((List<?>)activity.get("items")).size());
        String management="http://127.0.0.1:"+environment.getProperty("local.management.port");
        var raw=HttpClient.newHttpClient();
        assertEquals(200,raw.send(HttpRequest.newBuilder(URI.create(management+"/actuator/health/readiness")).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(401,raw.send(HttpRequest.newBuilder(URI.create(management+"/actuator/metrics")).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode());
        String basic=Base64.getEncoder().encodeToString("test-operator:operator-test-only-123".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var metrics=raw.send(HttpRequest.newBuilder(URI.create(management+"/actuator/prometheus")).header("Authorization","Basic "+basic).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,metrics.statusCode());assertTrue(metrics.body().contains("studio_project_events_total"));
        assertEquals(401,raw.send(HttpRequest.newBuilder(URI.create(client.base+"/api/projects")).header("Authorization","Basic "+basic).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(200,raw.send(HttpRequest.newBuilder(URI.create(client.base+"/api/docs")).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode());
        for(int i=0;i<3;i++)client.call("/api/auth/login","POST",Map.of("email",email,"password","WrongPassword123"),401);
        var blocked=client.http.send(client.request("/api/auth/login","POST",Map.of("email",email,"password","WrongPassword123")),HttpResponse.BodyHandlers.ofString());
        assertEquals(429,blocked.statusCode());assertTrue(Long.parseLong(blocked.headers().firstValue("Retry-After").orElseThrow())>0);
        client.call("/api/auth/logout","POST",null,204);
    }
}
