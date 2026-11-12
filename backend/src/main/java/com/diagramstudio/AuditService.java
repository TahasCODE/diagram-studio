package com.diagramstudio;

import java.time.Instant;
import java.util.UUID;
import org.slf4j.MDC;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AuditService {
    public enum Action { PROJECT_CREATED, PROJECT_UPDATED, PROJECT_PUBLISHED, PROJECT_RESTORED, PROJECT_REMIXED, PROJECT_DELETED }
    public record Event(long id, UUID projectId, String action, Long version, String requestId, Instant createdAt) {}
    private final JdbcTemplate jdbc;
    private final MeterRegistry meters;
    public AuditService(JdbcTemplate jdbc,MeterRegistry meters) {this.jdbc=jdbc;this.meters=meters;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(UUID owner,UUID project,Action action,Long version) {
        jdbc.update("INSERT INTO audit_events(owner_id,project_id,action,version,request_id) VALUES (?,?,?,?,?)",owner,project,action.name(),version,MDC.get("requestId"));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {meters.counter("studio.project.events","action",action.name()).increment();}
        });
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageResult<Event> list(UUID owner,UUID project,int page,int size) {
        PageResult.validate(page,size);
        String where=" WHERE owner_id=?"+(project==null?"":" AND project_id=?");
        java.util.List<Object> values=new java.util.ArrayList<>();values.add(owner);if(project!=null)values.add(project);
        long total=jdbc.queryForObject("SELECT count(*) FROM audit_events"+where,Long.class,values.toArray());
        values.add(size);values.add((long)page*size);
        var events=jdbc.query("SELECT id,project_id,action,version,request_id,created_at FROM audit_events"+where+" ORDER BY id DESC LIMIT ? OFFSET ?",
            (rs,row)->new Event(rs.getLong("id"),rs.getObject("project_id",UUID.class),rs.getString("action"),rs.getObject("version",Long.class),rs.getString("request_id"),rs.getTimestamp("created_at").toInstant()),values.toArray());
        return PageResult.of(events,page,size,total);
    }
}
