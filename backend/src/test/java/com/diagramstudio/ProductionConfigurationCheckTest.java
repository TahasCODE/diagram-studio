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
    @Test void guestDemoSkipsOnlyMailRequirements() {
        var env=new MockEnvironment().withProperty("studio.accounts.enabled","false");
        assertThrows(IllegalStateException.class,()->check(env));
        env.setProperty("spring.datasource.password","demo-database-secret");assertThrows(IllegalStateException.class,()->check(env));
        env.setProperty("server.servlet.session.cookie.secure","true");assertDoesNotThrow(()->check(env));
    }
    @Test void gmailApiRequiresItsOwnCredentialsButDoesNotRequireSmtp() {
        var env=configured().withProperty("studio.mail.provider","gmail-api").withProperty("spring.mail.username","").withProperty("spring.mail.password","")
            .withProperty("studio.mail.gmail.client-id","test-client").withProperty("studio.mail.gmail.client-secret","test-client-secret").withProperty("studio.mail.gmail.refresh-token","test-refresh");
        assertDoesNotThrow(()->check(env));
        for(var key:new String[]{"client-id","client-secret","refresh-token"}){
            var value=env.getProperty("studio.mail.gmail."+key);env.setProperty("studio.mail.gmail."+key,"");assertThrows(IllegalStateException.class,()->check(env));env.setProperty("studio.mail.gmail."+key,value);
        }
        assertThrows(IllegalStateException.class,()->check(configured().withProperty("studio.mail.provider","unknown")));
    }
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
