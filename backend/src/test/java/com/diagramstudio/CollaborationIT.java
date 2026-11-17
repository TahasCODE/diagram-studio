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
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=${STUDIO_TEST_DB_URL:jdbc:postgresql://localhost:55432/diagram_studio_test}",
    "management.server.port=0","studio.auth-rate-limit.max-attempts=200"
})
class CollaborationIT {
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired PasswordEncoder passwords;
    final List<UUID> users=new ArrayList<>();
    @AfterEach void cleanup(){for(UUID id:users)jdbc.update("DELETE FROM app_users WHERE id=?",id);}
    class Client {
        final UUID id=UUID.randomUUID();
        final String email="collaboration-"+id+"@example.test";
        final HttpClient http=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
        final String base="http://127.0.0.1:"+environment.getProperty("local.server.port")+"/api";
        String csrf;
        Client()throws Exception{
            users.add(id);
            jdbc.update("INSERT INTO app_users(id,name,email,password_hash,email_verified_at) VALUES (?,?,?,?,now())",id,"Collaboration Test",email,passwords.encode("CollaborationPassword123"));
            csrf=(String)call("/auth/me","GET",null,200).get("csrfToken");
            call("/auth/login","POST",Map.of("email",email,"password","CollaborationPassword123"),200);
            csrf=(String)call("/auth/me","GET",null,200).get("csrfToken");
        }
        HttpRequest request(String path,String method,Object body){
            var builder=HttpRequest.newBuilder(URI.create(base+path)).header("X-CSRF-TOKEN",csrf==null?"":csrf).timeout(java.time.Duration.ofSeconds(20));
            if(body!=null)builder.header("Content-Type","application/json");
            return builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
        }
        @SuppressWarnings("unchecked") Map<String,Object> call(String path,String method,Object body,int status)throws Exception{
            var response=http.send(request(path,method,body),HttpResponse.BodyHandlers.ofString());
            assertEquals(status,response.statusCode(),response.body());
            if(status==204)return Map.of();
            if(response.body().startsWith("["))return Map.of("items",json.readValue(response.body(),List.class));
            return json.readValue(response.body(),Map.class);
        }
    }
    Map<String,Object> document(String title){return Map.of("title",title,"nodes",List.of(Map.of("id","a","label","API","x",20,"y",30)),"scenarios",List.of(Map.of("name","Read","steps",List.of("a"))));}
    @Test void nodeDiscussionsRespectMembershipResolutionAndSnapshotBoundaries()throws Exception{
        var owner=new Client();var viewer=new Client();var outsider=new Client();
        var draft=owner.call("/projects","POST",Map.of("document",document("Review flow")),201);
        String project="/projects/"+draft.get("id"),comments=project+"/comments";
        owner.call(project+"/members","POST",Map.of("email",viewer.email,"role","VIEWER"),204);
        viewer.call(comments,"GET",null,404);
        viewer.call(comments,"POST",Map.of("nodeId","a","body","Pending"),404);
        viewer.call("/invitations/"+draft.get("id")+"/accept","POST",null,204);
        owner.call(comments,"POST",Map.of("nodeId","a","body","   "),400);
        owner.call(comments,"POST",Map.of("nodeId","a","body","x".repeat(1001)),400);
        owner.call(comments,"POST",Map.of("nodeId","unsaved","body","Where is this node?"),400);
        var thread=viewer.call(comments,"POST",Map.of("nodeId","a","body","<script>alert('text only')</script>"),201);
        String path=comments+"/"+thread.get("id");
        assertEquals(viewer.id.toString(),thread.get("authorId"));assertEquals("API",thread.get("nodeLabel"));
        owner.call(path+"/replies","POST",Map.of("body","Add a retry limit here."),201);
        viewer.call(path+"/replies","POST",Map.of("body","Agreed."),201);
        assertEquals(2,((Number)viewer.call(path+"/replies?size=1","GET",null,200).get("totalPages")).intValue());
        assertEquals(0,((Number)viewer.call(comments+"?nodeId=another","GET",null,200).get("total")).intValue());
        viewer.call(comments+"?size=51","GET",null,400);
        assertEquals(1,((Number)owner.call(project,"GET",null,200).get("version")).intValue());
        var publication=owner.call(project+"/publications","POST",Map.of("version",1),201);
        var publishedDocument=owner.call("/publications/"+publication.get("id"),"GET",null,200).get("document");
        viewer.call(path,"PATCH",Map.of("version",1,"resolved",true),200);
        viewer.call(path+"/replies","POST",Map.of("body","Reply after resolve"),409);
        owner.call(path,"PATCH",Map.of("version",1,"resolved",false),409);
        owner.call(path,"PATCH",Map.of("version",2,"resolved",false),200);
        var ownerThread=owner.call(comments,"POST",Map.of("nodeId","a","body","Review database capacity."),201);
        viewer.call(comments+"/"+ownerThread.get("id"),"PATCH",Map.of("version",1,"resolved",true),403);
        owner.call(project+"/members/"+viewer.id,"PATCH",Map.of("role","EDITOR"),204);
        viewer.call(comments+"/"+ownerThread.get("id"),"PATCH",Map.of("version",1,"resolved",true),200);
        // Another project owned by the same reader cannot be used to fetch this thread.
        var other=owner.call("/projects","POST",Map.of("document",document("Other")),201);
        owner.call("/projects/"+other.get("id")+"/comments/"+thread.get("id"),"GET",null,404);
        outsider.call(comments,"GET",null,404);outsider.call(path+"/replies","POST",Map.of("body","No access"),404);
        var withoutNode=Map.of("title","Review flow","nodes",List.of(),"scenarios",List.of(Map.of("name","Read","steps",List.of())));
        owner.call(project,"PUT",Map.of("version",1,"document",withoutNode),200);
        assertEquals("API",owner.call(path,"GET",null,200).get("nodeLabel"));
        owner.call(comments,"POST",Map.of("nodeId","a","body","Removed node"),400);
        assertEquals(publishedDocument,owner.call("/publications/"+publication.get("id"),"GET",null,200).get("document"));
        owner.call(project+"/members/"+viewer.id,"DELETE",null,204);
        viewer.call(path,"GET",null,404);viewer.call(path+"/replies","POST",Map.of("body","Revoked"),404);
        owner.call(project+"?version=2","DELETE",null,204);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM node_discussions WHERE project_id=?",Integer.class,UUID.fromString((String)draft.get("id"))));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM discussion_replies WHERE discussion_id=?",Integer.class,UUID.fromString((String)thread.get("id"))));
    }
    @Test void invitationsPermissionsConflictsAndRevocation()throws Exception{
        var owner=new Client();var editor=new Client();var viewer=new Client();var outsider=new Client();
        var draft=owner.call("/projects","POST",Map.of("document",document("Shared read flow")),201);
        String path="/projects/"+draft.get("id");
        assertEquals("OWNER",draft.get("role"));
        owner.call(path+"/members","POST",Map.of("email",editor.email,"role","EDITOR"),204);
        owner.call(path+"/members","POST",Map.of("email",viewer.email,"role","VIEWER"),204);
        owner.call(path+"/members","POST",Map.of("email",editor.email,"role","EDITOR"),409);
        owner.call(path+"/members","POST",Map.of("email",owner.email,"role","VIEWER"),400);
        owner.call(path+"/members","POST",Map.of("email",outsider.email,"role","OWNER"),400);
        // Pending invites confer no read or list access and cannot be stolen.
        editor.call(path,"GET",null,404);
        assertEquals(0,((Number)editor.call("/projects","GET",null,200).get("total")).intValue());
        outsider.call("/invitations/"+draft.get("id")+"/accept","POST",null,404);
        editor.call("/invitations/"+draft.get("id")+"/accept","POST",null,204);
        viewer.call("/invitations/"+draft.get("id"),"DELETE",null,204);
        viewer.call(path,"GET",null,404);
        owner.call(path+"/members","POST",Map.of("email",viewer.email,"role","VIEWER"),204);
        viewer.call("/invitations/"+draft.get("id")+"/accept","POST",null,204);
        assertEquals("EDITOR",editor.call(path,"GET",null,200).get("role"));
        assertEquals("VIEWER",viewer.call(path,"GET",null,200).get("role"));
        assertEquals(1,((Number)editor.call("/projects?q=Shared","GET",null,200).get("total")).intValue());
        viewer.call(path+"/revisions","GET",null,200);
        for(var client:List.of(viewer,editor)){
            client.call(path+"/members","GET",null,403);
            client.call(path+"/members","POST",Map.of("email",outsider.email,"role","EDITOR"),403);
            client.call(path+"/members/"+viewer.id,"PATCH",Map.of("role","EDITOR"),403);
            client.call(path+"/members/"+viewer.id,"DELETE",null,403);
            client.call(path+"/publications","POST",Map.of("version",1),403);
            client.call(path+"?version=1","DELETE",null,403);
        }
        viewer.call(path,"PUT",Map.of("version",1,"document",document("Forbidden")),403);
        viewer.call(path+"/restore","POST",Map.of("version",1,"revisionVersion",1),403);
        // Owner and accepted editor still share the original optimistic version check.
        var a=owner.http.sendAsync(owner.request(path,"PUT",Map.of("version",1,"document",document("Owner save"))),HttpResponse.BodyHandlers.ofString());
        var b=editor.http.sendAsync(editor.request(path,"PUT",Map.of("version",1,"document",document("Editor save"))),HttpResponse.BodyHandlers.ofString());
        assertEquals(List.of(200,409),List.of(a.join().statusCode(),b.join().statusCode()).stream().sorted().toList());
        var publication=owner.call(path+"/publications","POST",Map.of("version",2),201);
        editor.call(path+"/restore","POST",Map.of("version",2,"revisionVersion",1),200);
        assertEquals(3,((Number)owner.call(path,"GET",null,200).get("version")).intValue());
        // Downgrade is enforced server-side even if a tab still thinks it is Editor.
        owner.call(path+"/members/"+editor.id,"PATCH",Map.of("role","VIEWER"),204);
        editor.call(path,"PUT",Map.of("version",3,"document",document("Stale permission")),403);
        owner.call(path+"/members/"+editor.id,"DELETE",null,204);
        editor.call(path,"GET",null,404);editor.call(path+"/revisions","GET",null,404);
        assertEquals(0,((Number)editor.call("/projects","GET",null,200).get("total")).intValue());
        outsider.call(path,"GET",null,404);outsider.call(path+"/members","GET",null,404);
        // Draft membership changes do not rewrite a previously published document.
        assertEquals(publication.get("title"),owner.call("/publications/"+publication.get("id"),"GET",null,200).get("title"));
        owner.call(path+"?version=3","DELETE",null,204);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM project_members WHERE project_id=?",Integer.class,UUID.fromString((String)draft.get("id"))));
    }
}
