package com.diagramstudio;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DiscussionService {
    public record Discussion(UUID id,String nodeId,String nodeLabel,UUID authorId,String authorName,String body,boolean resolved,long version,Instant createdAt,long replyCount) {}
    public record Reply(UUID id,UUID authorId,String authorName,String body,Instant createdAt) {}
    private final JdbcTemplate jdbc;
    private final ProjectAccess access;
    private final ProjectService projects;
    private final AuditService audit;
    private static final String SELECT="SELECT d.*,coalesce(u.name,'Former member') AS author_name,(SELECT count(*) FROM discussion_replies r WHERE r.discussion_id=d.id) AS reply_count FROM node_discussions d LEFT JOIN app_users u ON u.id=d.author_id";
    public DiscussionService(JdbcTemplate jdbc,ProjectAccess access,ProjectService projects,AuditService audit){this.jdbc=jdbc;this.access=access;this.projects=projects;this.audit=audit;}

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageResult<Discussion> list(UUID actor,UUID project,String nodeId,int page,int size){
        access.role(actor,project);PageResult.validate(page,size);
        if(nodeId!=null&&nodeId.length()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Node ID must be at most 100 characters.");
        String where=" WHERE d.project_id=?"+(nodeId==null?"":" AND d.node_id=?");
        var args=new java.util.ArrayList<Object>();args.add(project);if(nodeId!=null)args.add(nodeId);
        long total=jdbc.queryForObject("SELECT count(*) FROM node_discussions d"+where,Long.class,args.toArray());
        args.add(size);args.add((long)page*size);
        return PageResult.of(jdbc.query(SELECT+where+" ORDER BY d.created_at DESC,d.id DESC LIMIT ? OFFSET ?",this::discussion,args.toArray()),page,size,total);
    }
    public Discussion get(UUID actor,UUID project,UUID id){
        access.role(actor,project);
        return jdbc.query(SELECT+" WHERE d.project_id=? AND d.id=?",this::discussion,project,id).stream().findFirst().orElseThrow(DiscussionService::missing);
    }
    @Transactional
    public Discussion create(UUID actor,UUID project,String nodeId,String body){
        access.lockMember(actor,project);
        var node=projects.get(actor,project).document().nodes().stream().filter(n->n.id().equals(nodeId)).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Save this node online before starting a discussion. It may have been removed."));
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO node_discussions(id,project_id,node_id,node_label,author_id,body) VALUES (?,?,?,?,?,?)",id,project,nodeId,node.label(),actor,body.trim());
        audit.record(actor,project,AuditService.Action.DISCUSSION_CREATED,null);
        return get(actor,project,id);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageResult<Reply> replies(UUID actor,UUID project,UUID id,int page,int size){
        get(actor,project,id);PageResult.validate(page,size);
        long total=jdbc.queryForObject("SELECT count(*) FROM discussion_replies WHERE discussion_id=?",Long.class,id);
        var rows=jdbc.query("SELECT r.*,coalesce(u.name,'Former member') AS author_name FROM discussion_replies r LEFT JOIN app_users u ON u.id=r.author_id WHERE r.discussion_id=? ORDER BY r.created_at,r.id LIMIT ? OFFSET ?",
            (rs,row)->new Reply(rs.getObject("id",UUID.class),rs.getObject("author_id",UUID.class),rs.getString("author_name"),rs.getString("body"),rs.getTimestamp("created_at").toInstant()),id,size,(long)page*size);
        return PageResult.of(rows,page,size,total);
    }
    @Transactional
    public Reply reply(UUID actor,UUID project,UUID id,String body){
        access.lockMember(actor,project);
        Discussion thread=get(actor,project,id);
        if(thread.resolved())throw new ResponseStatusException(HttpStatus.CONFLICT,"Reopen this discussion before replying. Your message has not been posted.");
        UUID reply=UUID.randomUUID();
        jdbc.update("INSERT INTO discussion_replies(id,discussion_id,author_id,body) VALUES (?,?,?,?)",reply,id,actor,body.trim());
        audit.record(actor,project,AuditService.Action.DISCUSSION_REPLIED,null);
        return jdbc.queryForObject("SELECT r.*,u.name FROM discussion_replies r JOIN app_users u ON u.id=r.author_id WHERE r.id=?",
            (rs,row)->new Reply(reply,actor,rs.getString("name"),rs.getString("body"),rs.getTimestamp("created_at").toInstant()),reply);
    }
    @Transactional
    public Discussion resolve(UUID actor,UUID project,UUID id,long version,boolean resolved){
        var role=access.lockMember(actor,project);Discussion thread=get(actor,project,id);
        if(role==ProjectAccess.Role.VIEWER&&!actor.equals(thread.authorId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the discussion author, an Editor or the Owner can resolve or reopen it.");
        if(jdbc.update("UPDATE node_discussions SET resolved=?,version=version+1 WHERE id=? AND project_id=? AND version=?",resolved,id,project,version)==0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"This discussion changed. Refresh before resolving or reopening it.");
        audit.record(actor,project,resolved?AuditService.Action.DISCUSSION_RESOLVED:AuditService.Action.DISCUSSION_REOPENED,null);
        return get(actor,project,id);
    }
    private Discussion discussion(ResultSet rs,int row)throws SQLException{
        return new Discussion(rs.getObject("id",UUID.class),rs.getString("node_id"),rs.getString("node_label"),rs.getObject("author_id",UUID.class),rs.getString("author_name"),rs.getString("body"),rs.getBoolean("resolved"),rs.getLong("version"),rs.getTimestamp("created_at").toInstant(),rs.getLong("reply_count"));
    }
    private static ResponseStatusException missing(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"This discussion was not found.");}
}
