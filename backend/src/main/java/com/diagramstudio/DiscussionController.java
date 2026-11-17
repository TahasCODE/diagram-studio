package com.diagramstudio;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/comments")
public class DiscussionController {
    public record Start(@NotBlank @Size(max=100) String nodeId,@NotBlank @Size(max=1000) String body) {}
    public record Message(@NotBlank @Size(max=1000) String body) {}
    public record Resolution(@Min(1) long version,@NotNull Boolean resolved) {}
    private final DiscussionService discussions;
    public DiscussionController(DiscussionService discussions){this.discussions=discussions;}
    @GetMapping
    PageResult<DiscussionService.Discussion> list(Authentication auth,@PathVariable UUID project,@RequestParam(required=false) String nodeId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return discussions.list(actor(auth),project,nodeId,page,size);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    DiscussionService.Discussion create(Authentication auth,@PathVariable UUID project,@Valid @RequestBody Start input){return discussions.create(actor(auth),project,input.nodeId(),input.body());}
    @GetMapping("/{id}")
    DiscussionService.Discussion get(Authentication auth,@PathVariable UUID project,@PathVariable UUID id){return discussions.get(actor(auth),project,id);}
    @GetMapping("/{id}/replies")
    PageResult<DiscussionService.Reply> replies(Authentication auth,@PathVariable UUID project,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return discussions.replies(actor(auth),project,id,page,size);}
    @PostMapping("/{id}/replies") @ResponseStatus(HttpStatus.CREATED)
    DiscussionService.Reply reply(Authentication auth,@PathVariable UUID project,@PathVariable UUID id,@Valid @RequestBody Message input){return discussions.reply(actor(auth),project,id,input.body());}
    @PatchMapping("/{id}")
    DiscussionService.Discussion resolve(Authentication auth,@PathVariable UUID project,@PathVariable UUID id,@Valid @RequestBody Resolution input){return discussions.resolve(actor(auth),project,id,input.version(),input.resolved());}
    private UUID actor(Authentication auth){return UUID.fromString(auth.getName());}
}
