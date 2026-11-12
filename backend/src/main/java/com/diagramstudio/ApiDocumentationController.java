package com.diagramstudio;

import java.io.IOException;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

@RestController
public class ApiDocumentationController {
    private final ClassPathResource specification=new ClassPathResource("api/openapi.json");
    private final JsonMapper json;
    public ApiDocumentationController(JsonMapper json) {this.json=json;}
    @GetMapping(value="/api/openapi.json",produces=MediaType.APPLICATION_JSON_VALUE)
    byte[] specification() throws IOException {return specification.getContentAsByteArray();}
    @SuppressWarnings("unchecked")
    @GetMapping(value="/api/docs",produces=MediaType.TEXT_HTML_VALUE)
    String documentation() throws IOException {
        Map<String,Object> spec=json.readValue(specification.getInputStream(),Map.class);
        Map<String,Object> paths=(Map<String,Object>)spec.get("paths");
        StringBuilder html=new StringBuilder("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Diagram Studio API Reference</title><style>body{font:15px/1.7 system-ui,sans-serif;color:#25372f;background:#f7f9f7;margin:0}main{max-width:1000px;margin:auto;padding:44px 24px}h1{letter-spacing:-1px}a{color:#276653}table{width:100%;border-collapse:collapse;background:white;font-size:13px}th,td{padding:13px;text-align:left;border-bottom:1px solid #dde4de;vertical-align:top}code{font-size:12px;overflow-wrap:anywhere}p{max-width:760px}.method{font-weight:700;white-space:nowrap}article{background:#fff;padding:20px;border:1px solid #dde4de;margin:22px 0}thead{background:#eef4ee}</style><main><a href=\"/\">← Diagram Studio</a><h1>API Reference</h1><p>Java 21 · Spring Boot · PostgreSQL. All paths are relative to <code>/api</code>. <a href=\"/api/openapi.json\">Download OpenAPI 3.1</a>.</p><article><strong>Authentication and writes</strong><p>Fetch <code>GET /api/auth/me</code> to obtain a session cookie and CSRF token. Send the token in <code>X-CSRF-TOKEN</code> on writes. Registration creates an account; sign in separately. Private resources require the owning account. Errors use Problem Details and include a request ID. JSON bodies are limited to 1 MB.</p><p>Projects and activity return bounded pages. Saves and restores require the current version; HTTP 409 protects against lost updates. Authentication attempts are rate limited and return HTTP 429 with Retry-After.</p></article><table><thead><tr><th>Method</th><th>Path</th><th>Behavior</th></tr></thead><tbody>");
        paths.forEach((path,value)->((Map<String,Object>)value).forEach((method,operation)-> {
            if(java.util.Set.of("get","post","put","delete","patch").contains(method)) {
                Object description=((Map<String,Object>)operation).getOrDefault("description","");
                html.append("<tr><td class=\"method\">").append(escape(method.toUpperCase(java.util.Locale.ROOT))).append("</td><td><code>").append(escape(path)).append("</code></td><td>").append(escape(String.valueOf(description))).append("</td></tr>");
            }
        }));
        return html.append("</tbody></table><p>Health probes and operator-protected metrics run on a separate management port. Operator credentials do not grant project ownership.</p></main></html>").toString();
    }
    private static String escape(String value) {return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
}
