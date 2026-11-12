package com.diagramstudio;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/activity")
public class AuditController {
    private final AuditService audit;
    public AuditController(AuditService audit) {this.audit=audit;}
    @GetMapping
    PageResult<AuditService.Event> activity(Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) UUID projectId) {
        return audit.list(UUID.fromString(authentication.getName()),projectId,page,size);
    }
}
