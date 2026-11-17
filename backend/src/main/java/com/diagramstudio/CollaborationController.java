package com.diagramstudio;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CollaborationController {
    public enum MemberRole { EDITOR, VIEWER }
    public record Invite(@NotBlank @Email @Size(max=254) String email,@NotNull MemberRole role) {}
    public record ChangeRole(@NotNull MemberRole role) {}
    public record Member(UUID id,String name,String email,String role,boolean accepted) {}
    public record Invitation(UUID projectId,String title,String ownerName,String role,Instant invitedAt) {}
    private final JdbcTemplate jdbc;
    private final ProjectAccess access;
    private final AuditService audit;
    public CollaborationController(JdbcTemplate jdbc,ProjectAccess access,AuditService audit){this.jdbc=jdbc;this.access=access;this.audit=audit;}

    @GetMapping("/projects/{id}/members")
    public List<Member> members(Authentication auth,@PathVariable UUID id){
        if(access.role(actor(auth),id)!=ProjectAccess.Role.OWNER)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the owner can manage members.");
        return jdbc.query("SELECT u.id,u.name,u.email,'OWNER' AS role,true AS accepted FROM projects p JOIN app_users u ON u.id=p.owner_id WHERE p.id=? UNION ALL SELECT u.id,u.name,u.email,m.role,m.accepted FROM project_members m JOIN app_users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY role,name",
            (rs,row)->new Member(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("email"),rs.getString("role"),rs.getBoolean("accepted")),id,id);
    }
    @PostMapping("/projects/{id}/members")
    @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void invite(Authentication auth,@PathVariable UUID id,@Valid @RequestBody Invite input){
        UUID actor=actor(auth);access.lock(actor,id,true);
        String email=input.email().trim().toLowerCase(Locale.ROOT);
        var users=jdbc.query("SELECT id FROM app_users WHERE email=? AND email_verified_at IS NOT NULL",(rs,row)->rs.getObject(1,UUID.class),email);
        if(users.isEmpty()||users.getFirst().equals(actor))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose another existing verified account. The project owner already has access.");
        int changed=jdbc.update("INSERT INTO project_members(project_id,user_id,role) VALUES (?,?,?) ON CONFLICT DO NOTHING",id,users.getFirst(),input.role().name());
        if(changed==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"This account already has access or a pending invitation. Change its role or remove it first.");
        audit.record(actor,id,AuditService.Action.MEMBER_INVITED,null);
    }
    @PatchMapping("/projects/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void change(Authentication auth,@PathVariable UUID id,@PathVariable UUID userId,@Valid @RequestBody ChangeRole input){
        UUID actor=actor(auth);access.lock(actor,id,true);
        if(jdbc.update("UPDATE project_members SET role=? WHERE project_id=? AND user_id=?",input.role().name(),id,userId)==0)throw missing();
        audit.record(actor,id,AuditService.Action.MEMBER_ROLE_CHANGED,null);
    }
    @DeleteMapping("/projects/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void remove(Authentication auth,@PathVariable UUID id,@PathVariable UUID userId){
        UUID actor=actor(auth);access.lock(actor,id,true);
        if(jdbc.update("DELETE FROM project_members WHERE project_id=? AND user_id=?",id,userId)==0)throw missing();
        audit.record(actor,id,AuditService.Action.MEMBER_REMOVED,null);
    }
    @GetMapping("/invitations")
    public List<Invitation> invitations(Authentication auth){
        return jdbc.query("SELECT p.id,p.title,u.name,m.role,m.invited_at FROM project_members m JOIN projects p ON p.id=m.project_id JOIN app_users u ON u.id=p.owner_id WHERE m.user_id=? AND NOT m.accepted ORDER BY m.invited_at DESC LIMIT 100",
            (rs,row)->new Invitation(rs.getObject("id",UUID.class),rs.getString("title"),rs.getString("name"),rs.getString("role"),rs.getTimestamp("invited_at").toInstant()),actor(auth));
    }
    @PostMapping("/invitations/{id}/accept")
    @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void accept(Authentication auth,@PathVariable UUID id){respond(actor(auth),id,true);}
    @DeleteMapping("/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void decline(Authentication auth,@PathVariable UUID id){respond(actor(auth),id,false);}
    private void respond(UUID actor,UUID id,boolean accept){
        // Same lock ordering as owners' invite/revoke and editors' saves.
        jdbc.query("SELECT id FROM projects WHERE id=? FOR UPDATE",(rs,row)->rs.getObject(1,UUID.class),id);
        int changed=accept?jdbc.update("UPDATE project_members SET accepted=true WHERE project_id=? AND user_id=? AND NOT accepted",id,actor):jdbc.update("DELETE FROM project_members WHERE project_id=? AND user_id=? AND NOT accepted",id,actor);
        if(changed==0)throw missing();
        audit.record(actor,id,accept?AuditService.Action.INVITATION_ACCEPTED:AuditService.Action.INVITATION_DECLINED,null);
    }
    private static UUID actor(Authentication auth){return UUID.fromString(auth.getName());}
    private static ResponseStatusException missing(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"This member or invitation was not found.");}
}
