package com.diagramstudio;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class ProductionConfigurationCheck implements ApplicationRunner {
    private final Environment environment;
    public ProductionConfigurationCheck(Environment environment) {this.environment=environment;}
    @Override public void run(ApplicationArguments args) {
        String password=environment.getProperty("spring.datasource.password","");
        if(password.isBlank() || "diagram_local_only".equals(password)) throw new IllegalStateException("Production requires a configured database password; the development password is not allowed.");
        if(!environment.getProperty("server.servlet.session.cookie.secure",Boolean.class,false)) throw new IllegalStateException("Production requires secure cookies and HTTPS. Set COOKIE_SECURE=true.");
    }
}
