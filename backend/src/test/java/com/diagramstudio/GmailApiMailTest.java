package com.diagramstudio;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Base64;
import java.util.Properties;
import java.io.ByteArrayInputStream;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

class GmailApiMailTest {
    @Test void refreshesSenderTokenCachesItAndSendsUtf8MimeWithoutSmtp() throws Exception {
        var tokens=new AtomicInteger();var sends=new AtomicInteger();var form=new AtomicReference<String>();var payload=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/token",e->{tokens.incrementAndGet();form.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));byte[] data="{\"access_token\":\"test-access\",\"expires_in\":3600,\"token_type\":\"Bearer\"}".getBytes();e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});
        server.createContext("/send",e->{sends.incrementAndGet();assertEquals("Bearer test-access",e.getRequestHeaders().getFirst("Authorization"));payload.set(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));byte[] data="{\"id\":\"mail-id\"}".getBytes();e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});
        server.start();try{
            var mail=client(server);mail.send(message());mail.send(message());
            assertEquals(1,tokens.get());assertEquals(2,sends.get());assertTrue(form.get().contains("client_secret=test%26secret"));assertTrue(form.get().contains("grant_type=refresh_token"));
            String raw=JsonMapper.builder().build().readTree(payload.get()).path("raw").asText();
            var mime=new MimeMessage(Session.getInstance(new Properties()),new ByteArrayInputStream(Base64.getUrlDecoder().decode(raw)));
            assertEquals("Verify your Diagram Studio email",mime.getSubject());assertTrue(mime.getContent().toString().contains("000111"));assertEquals("recipient@example.test",mime.getAllRecipients()[0].toString());
        }finally{server.stop(0);}
    }
    @Test void retriesOnlyRejectedAuthorizationAndNeverLeaksProviderBodies() throws Exception {
        var tokens=new AtomicInteger();var sends=new AtomicInteger();var status=new AtomicInteger(401);
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/token",e->{tokens.incrementAndGet();byte[] data="{\"access_token\":\"test-access\",\"expires_in\":3600,\"token_type\":\"Bearer\"}".getBytes();e.sendResponseHeaders(200,data.length);e.getResponseBody().write(data);e.close();});
        server.createContext("/send",e->{sends.incrementAndGet();e.getRequestBody().readAllBytes();int code=status.getAndSet(200);byte[] data=(code==200?"{\"id\":\"sent\"}":"provider-secret-code-000111").getBytes();e.sendResponseHeaders(code,data.length);e.getResponseBody().write(data);e.close();});
        server.start();try{
            var mail=client(server);mail.send(message());assertEquals(2,tokens.get());assertEquals(2,sends.get());
            status.set(429);var error=assertThrows(GmailApiMail.DeliveryFailure.class,()->mail.send(message()));
            assertEquals(3,sends.get());assertEquals("Email delivery is unavailable.",error.getMessage());assertNull(error.getCause());
        }finally{server.stop(0);}
    }
    @Test void revokedRefreshTokenCannotSendOrExposeCredentials() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);var sends=new AtomicInteger();
        server.createContext("/token",e->{byte[] data="invalid_grant test-refresh private@example.test".getBytes();e.sendResponseHeaders(400,data.length);e.getResponseBody().write(data);e.close();});
        server.createContext("/send",e->{sends.incrementAndGet();e.sendResponseHeaders(500,-1);e.close();});
        server.start();try{var error=assertThrows(GmailApiMail.DeliveryFailure.class,()->client(server).send(message()));assertNull(error.getCause());assertFalse(error.toString().contains("test-refresh"));assertEquals(0,sends.get());}finally{server.stop(0);}
    }
    private GmailApiMail client(HttpServer server){var base="http://127.0.0.1:"+server.getAddress().getPort();return new GmailApiMail(HttpClient.newHttpClient(),URI.create(base+"/token"),URI.create(base+"/send"),"test-client","test&secret","test-refresh");}
    private SimpleMailMessage message(){var message=new SimpleMailMessage();message.setFrom("sender@example.test");message.setTo("recipient@example.test");message.setSubject("Verify your Diagram Studio email");message.setText("Verification code: 000111. Café.");return message;}
}
