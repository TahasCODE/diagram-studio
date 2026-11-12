package com.diagramstudio;
import java.time.Duration;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.*;
import static org.junit.jupiter.api.Assertions.*;

class HttpInfrastructureTest {
    @Test void correlatesRequestResponseAndLogsWithoutTrustingCallerIds() throws Exception {
        var request=new MockHttpServletRequest("GET","/api/health");request.addHeader("X-Request-ID","untrusted-id");
        var response=new MockHttpServletResponse();
        new RequestTraceFilter().doFilter(request,response,(req,res)-> {
            assertNotNull(MDC.get("requestId"));
            assertEquals(req.getAttribute(RequestTraceFilter.ATTRIBUTE),MDC.get("requestId"));
        });
        assertDoesNotThrow(()->java.util.UUID.fromString(response.getHeader("X-Request-ID")));
        assertNull(MDC.get("requestId"));
    }
    @Test void rateLimitErrorsUseTheSharedProblemContract() throws Exception {
        var registry=new SimpleMeterRegistry();var filter=new AuthRateLimitFilter(1,Duration.ofMinutes(1),registry);
        var first=new MockHttpServletRequest("POST","/api/auth/login");first.setRemoteAddr("127.0.0.1");
        filter.doFilter(first,new MockHttpServletResponse(),new MockFilterChain());
        var next=new MockHttpServletRequest("POST","/api/auth/register");next.setRemoteAddr("127.0.0.1");next.setAttribute(RequestTraceFilter.ATTRIBUTE,"unit-test");
        var response=new MockHttpServletResponse();filter.doFilter(next,response,new MockFilterChain());
        assertEquals(429,response.getStatus());assertEquals("application/problem+json",response.getContentType());
        assertNotNull(response.getHeader("Retry-After"));assertTrue(response.getContentAsString().contains("unit-test"));
        assertEquals(1,registry.get("studio.auth.rate.limited").counter().count());
    }
    @Test void paginationIsBounded() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->PageResult.validate(-1,10));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->PageResult.validate(0,51));
        assertEquals(3,PageResult.of(java.util.List.of(),0,10,21).totalPages());
    }
    @Test void productionFailsClosedOnDevelopmentCredentialsOrInsecureCookies() {
        var environment=new org.springframework.mock.env.MockEnvironment();
        var check=new ProductionConfigurationCheck(environment);
        assertThrows(IllegalStateException.class,()->check.run(null));
        environment.setProperty("spring.datasource.password","configured-example-password");
        assertThrows(IllegalStateException.class,()->check.run(null));
        environment.setProperty("server.servlet.session.cookie.secure","true");
        assertDoesNotThrow(()->check.run(null));
    }
}
