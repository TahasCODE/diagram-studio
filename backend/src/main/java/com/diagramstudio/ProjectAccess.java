package com.diagramstudio;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectAccess {
    public enum Role { OWNER, EDITOR, VIEWER }
    private final JdbcTemplate jdbc;
    public ProjectAccess(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Role role(UUID actor,UUID project) {
        return jdbc.query("SELECT CASE WHEN p.owner_id=? THEN 'OWNER' ELSE m.role END AS role FROM projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=? AND m.accepted WHERE p.id=? AND (p.owner_id=? OR m.user_id IS NOT NULL)",
            (rs,row)->Role.valueOf(rs.getString("role")),actor,actor,project,actor).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"This project was not found or access has been removed."));
    }
    // All draft and membership mutations take the same project lock. A revoked or
    // downgraded member cannot race a save past the permission check.
    public Role lock(UUID actor,UUID project,boolean ownerOnly) {
        Role role=lockMember(actor,project);
        if(ownerOnly?role!=Role.OWNER:role==Role.VIEWER)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,ownerOnly?"Only the project owner can perform this action.":"Viewer access does not allow changes. Ask the owner for Editor access.");
        return role;
    }
    public Role lockMember(UUID actor,UUID project) {
        var ids=jdbc.query("SELECT id FROM projects WHERE id=? FOR UPDATE",(rs,row)->rs.getObject(1,UUID.class),project);
        if(ids.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"This project was not found.");
        return role(actor,project);
    }
}
