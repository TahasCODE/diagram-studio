package com.diagramstudio;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class ProductionConfigurationCheckTest {
    private MockEnvironment configured() {
        return new MockEnvironment()
            .withProperty("spring.datasource.password","unit-test-database-secret")
            .withProperty("server.servlet.session.cookie.secure","true")
            .withProperty("spring.mail.username","unit-test-sender")
            .withProperty("spring.mail.password","unit-test-mail-secret")
            .withProperty("spring.mail.properties.mail.smtp.auth","true")
            .withProperty("spring.mail.properties.mail.smtp.starttls.required","true")
            .withProperty("studio.mail.from","sender@example.com");
    }
    private void check(MockEnvironment env) { new ProductionConfigurationCheck(env).run(new DefaultApplicationArguments()); }
    @Test void acceptsConfiguredProductionProperties() {
        assertDoesNotThrow(() -> check(configured()));
    }
    @Test void rejectsMissingOrDevelopmentDatabaseSecrets() {
        for (var value : new String[]{"","diagram_local_only"})
            assertThrows(IllegalStateException.class,() -> check(configured().withProperty("spring.datasource.password",value)));
    }
    @Test void rejectsInsecureCookies() {
        assertThrows(IllegalStateException.class,() -> check(configured().withProperty("server.servlet.session.cookie.secure","false")));
    }
    @Test void rejectsMissingSenderCredentialsOrTls() {
        for (var key : new String[]{"spring.mail.username","spring.mail.password"})
            assertThrows(IllegalStateException.class,() -> check(configured().withProperty(key,"")));
        for (var key : new String[]{"spring.mail.properties.mail.smtp.auth","spring.mail.properties.mail.smtp.starttls.required"})
            assertThrows(IllegalStateException.class,() -> check(configured().withProperty(key,"false")));
    }
    @Test void rejectsMissingOrTestSenderAddress() {
        for (var value : new String[]{"","studio@localhost.test"})
            assertThrows(IllegalStateException.class,() -> check(configured().withProperty("studio.mail.from",value)));
    }
}
