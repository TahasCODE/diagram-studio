package com.diagramstudio;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ProjectController {
    public record Create(@NotNull DiagramDocument document) {}
    public record Update(@Min(1) long version, @NotNull DiagramDocument document) {}
    public record Publish(@Min(1) long version) {}
    public record Restore(@Min(1) long version, @Min(1) long revisionVersion) {}
    private final ProjectService projects;
    private final JdbcTemplate jdbc;
    public ProjectController(ProjectService projects, JdbcTemplate jdbc) { this.projects = projects; this.jdbc = jdbc; }

    @GetMapping("/health") Map<String,String> health() { jdbc.queryForObject("SELECT 1", Integer.class); return Map.of("status", "ok"); }
    @GetMapping("/projects") PageResult<ProjectService.Summary> list(Authentication auth,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size,@RequestParam(defaultValue="") String q) { return projects.list(owner(auth),page,size,q); }
    @PostMapping("/projects") @ResponseStatus(HttpStatus.CREATED)
    ProjectService.Draft create(Authentication auth, @Valid @RequestBody Create input) { return projects.create(owner(auth), input.document()); }
    @GetMapping("/projects/{id}")
    ProjectService.Draft get(Authentication auth, @PathVariable UUID id) { return projects.get(owner(auth), id); }
    @PutMapping("/projects/{id}")
    ProjectService.Draft update(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Update input) { return projects.update(owner(auth), id, input.version(), input.document()); }
    @DeleteMapping("/projects/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(Authentication auth, @PathVariable UUID id, @RequestParam long version) { projects.delete(owner(auth), id, version); }
    @PostMapping("/projects/{id}/publications") @ResponseStatus(HttpStatus.CREATED)
    ProjectService.PublicationSummary publish(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Publish input) { return projects.publish(owner(auth), id, input.version()); }
    @GetMapping("/projects/{id}/publications")
    List<ProjectService.PublicationSummary> publications(Authentication auth, @PathVariable UUID id) { return projects.publications(owner(auth), id); }
    @GetMapping("/projects/{id}/revisions")
    List<ProjectService.RevisionSummary> revisions(Authentication auth, @PathVariable UUID id) { return projects.revisions(owner(auth), id); }
    @GetMapping("/projects/{id}/revisions/{version}")
    ProjectService.Revision revision(Authentication auth, @PathVariable UUID id, @PathVariable long version) { return projects.revision(owner(auth), id, version); }
    @PostMapping("/projects/{id}/restore")
    ProjectService.Draft restore(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Restore input) { return projects.restore(owner(auth), id, input.version(), input.revisionVersion()); }
    @GetMapping("/publications/{id}")
    ProjectService.Publication publication(@PathVariable UUID id) { return projects.publication(id); }
    @PostMapping("/publications/{id}/remix") @ResponseStatus(HttpStatus.CREATED)
    ProjectService.Draft remix(Authentication auth, @PathVariable UUID id) { return projects.remix(owner(auth), id); }
    private UUID owner(Authentication auth) { return UUID.fromString(auth.getName()); }
}
