package com.diagramstudio;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ProjectService {
    public record Summary(UUID id, String title, long version, Instant updatedAt) {}
    public record Draft(UUID id, long version, Instant updatedAt, DiagramDocument document) {}
    public record PublicationSummary(UUID id, String title, Instant createdAt) {}
    public record Publication(UUID id, String title, Instant createdAt, DiagramDocument document) {}
    public record RevisionSummary(long version, String title, Instant createdAt) {}
    public record Revision(long version, String title, Instant createdAt, DiagramDocument document) {}
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final AuditService audit;
    public ProjectService(JdbcTemplate jdbc, JsonMapper json,AuditService audit) { this.jdbc = jdbc; this.json = json; this.audit=audit; }

    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public PageResult<Summary> list(UUID owner,int page,int size,String query) {
        PageResult.validate(page,size);
        if(query.length()>80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Search text must be at most 80 characters.");
        String pattern="%"+query.trim().replace("!","!!").replace("%","!%").replace("_","!_")+"%";
        long total=jdbc.queryForObject("SELECT count(*) FROM projects WHERE owner_id=? AND title ILIKE ? ESCAPE '!'",Long.class,owner,pattern);
        var items=jdbc.query("SELECT id,title,version,updated_at FROM projects WHERE owner_id=? AND title ILIKE ? ESCAPE '!' ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
            (rs,row)->new Summary(rs.getObject("id",UUID.class),rs.getString("title"),rs.getLong("version"),rs.getTimestamp("updated_at").toInstant()),owner,pattern,size,(long)page*size);
        return PageResult.of(items,page,size,total);
    }
    public Draft get(UUID owner, UUID id) {
        return jdbc.query("SELECT id,version,updated_at,document FROM projects WHERE id=? AND owner_id=?", this::draft, id, owner)
            .stream().findFirst().orElseThrow(ProjectService::notFound);
    }
    @Transactional
    public Draft create(UUID owner, DiagramDocument document) {
        document.validate();
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO projects(id,owner_id,title,document) VALUES (?,?,?,CAST(? AS jsonb))", id, owner, document.displayTitle(), json.writeValueAsString(document));
        Draft saved = get(owner, id);
        recordRevision(saved);
        audit.record(owner,id,AuditService.Action.PROJECT_CREATED,saved.version());
        return saved;
    }
    @Transactional
    public Draft update(UUID owner, UUID id, long version, DiagramDocument document) {
        document.validate();
        int changed = jdbc.update("UPDATE projects SET title=?,document=CAST(? AS jsonb),version=version+1,updated_at=now() WHERE id=? AND owner_id=? AND version=?",
            document.displayTitle(), json.writeValueAsString(document), id, owner, version);
        if (changed == 0) { get(owner, id); throw conflict(); }
        Draft saved = get(owner, id);
        recordRevision(saved);
        audit.record(owner,id,AuditService.Action.PROJECT_UPDATED,saved.version());
        return saved;
    }
    private void recordRevision(Draft draft) {
        jdbc.update("INSERT INTO project_revisions(project_id,version,title,document,created_at) VALUES (?,?,?,CAST(? AS jsonb),?)",
            draft.id(), draft.version(), draft.document().displayTitle(), json.writeValueAsString(draft.document()), java.sql.Timestamp.from(draft.updatedAt()));
    }
    public List<RevisionSummary> revisions(UUID owner, UUID id) {
        get(owner, id);
        return jdbc.query("SELECT version,title,created_at FROM project_revisions WHERE project_id=? ORDER BY version DESC LIMIT 100",
            (rs, row) -> new RevisionSummary(rs.getLong("version"), rs.getString("title"), rs.getTimestamp("created_at").toInstant()), id);
    }
    public Revision revision(UUID owner, UUID id, long version) {
        get(owner, id);
        return jdbc.query("SELECT version,title,created_at,document FROM project_revisions WHERE project_id=? AND version=?",
            (rs, row) -> new Revision(rs.getLong("version"), rs.getString("title"), rs.getTimestamp("created_at").toInstant(), json.readValue(rs.getString("document"), DiagramDocument.class)), id, version)
            .stream().findFirst().orElseThrow(ProjectService::notFound);
    }
    @Transactional
    public Draft restore(UUID owner, UUID id, long expectedVersion, long revisionVersion) {
        DiagramDocument document = revision(owner, id, revisionVersion).document();
        // Restore is a normal optimistic save. Old revisions and published snapshots are never rewritten.
        Draft restored=update(owner, id, expectedVersion, document);
        audit.record(owner,id,AuditService.Action.PROJECT_RESTORED,restored.version());
        return restored;
    }
    @Transactional
    public void delete(UUID owner, UUID id, long version) {
        int changed = jdbc.update("DELETE FROM projects WHERE id=? AND owner_id=? AND version=?", id, owner, version);
        if (changed == 0) { get(owner, id); throw conflict(); }
        audit.record(owner,id,AuditService.Action.PROJECT_DELETED,version);
    }
    @Transactional
    public PublicationSummary publish(UUID owner, UUID id, long version) {
        // Lock the owned draft so the version check and snapshot copy are atomic with saves.
        Draft draft = jdbc.query("SELECT id,version,updated_at,document FROM projects WHERE id=? AND owner_id=? FOR UPDATE", this::draft, id, owner)
            .stream().findFirst().orElseThrow(ProjectService::notFound);
        if (draft.version() != version) throw conflict();
        UUID publication = UUID.randomUUID();
        DiagramDocument document = draft.document().published();
        jdbc.update("INSERT INTO publications(id,project_id,title,document) VALUES (?,?,?,CAST(? AS jsonb))", publication, id, document.displayTitle(), json.writeValueAsString(document));
        Publication saved = publication(publication);
        audit.record(owner,id,AuditService.Action.PROJECT_PUBLISHED,version);
        return new PublicationSummary(saved.id(), saved.title(), saved.createdAt());
    }
    public List<PublicationSummary> publications(UUID owner, UUID id) {
        get(owner, id);
        return jdbc.query("SELECT id,title,created_at FROM publications WHERE project_id=? ORDER BY created_at DESC LIMIT 50",
            (rs, row) -> new PublicationSummary(rs.getObject("id", UUID.class), rs.getString("title"), rs.getTimestamp("created_at").toInstant()), id);
    }
    public Publication publication(UUID id) {
        return jdbc.query("SELECT id,title,created_at,document FROM publications WHERE id=?",
            (rs, row) -> new Publication(rs.getObject("id", UUID.class), rs.getString("title"), rs.getTimestamp("created_at").toInstant(), json.readValue(rs.getString("document"), DiagramDocument.class)), id)
            .stream().findFirst().orElseThrow(ProjectService::notFound);
    }
    @Transactional
    public Draft remix(UUID owner, UUID publication) {
        DiagramDocument source = publication(publication).document();
        String title = source.displayTitle();
        if (title.length() > 72) title = title.substring(0,72);
        Draft remixed=create(owner, new DiagramDocument(title + " (Remix)", source.nodes(), source.scenarios()));
        audit.record(owner,remixed.id(),AuditService.Action.PROJECT_REMIXED,remixed.version());
        return remixed;
    }
    private Draft draft(ResultSet rs, int row) throws SQLException {
        return new Draft(rs.getObject("id", UUID.class), rs.getLong("version"), rs.getTimestamp("updated_at").toInstant(), json.readValue(rs.getString("document"), DiagramDocument.class));
    }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "This project or published diagram was not found."); }
    private static ResponseStatusException conflict() { return new ResponseStatusException(HttpStatus.CONFLICT, "This project changed in another session. Reload it or save your work as a separate copy."); }
}
