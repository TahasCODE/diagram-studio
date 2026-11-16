package com.diagramstudio;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.Properties;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Server-owned sender authorization, never a visitor's Google account. */
@Service
public class GmailApiMail {
    private static final URI TOKEN_URI=URI.create("https://oauth2.googleapis.com/token");
    private static final URI SEND_URI=URI.create("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    private static final int MAX_RESPONSE_BYTES=65_536;
    private final HttpClient http;
    private final URI tokenUri,sendUri;
    private final String clientId,clientSecret,refreshToken;
    private final JsonMapper json=JsonMapper.builder().build();
    private String accessToken;
    private Instant refreshAt=Instant.EPOCH;

    @Autowired
    public GmailApiMail(@Value("${studio.mail.gmail.client-id:}") String clientId,
                        @Value("${studio.mail.gmail.client-secret:}") String clientSecret,
                        @Value("${studio.mail.gmail.refresh-token:}") String refreshToken) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build(),
            TOKEN_URI,SEND_URI,clientId,clientSecret,refreshToken);
    }
    // Loopback endpoints are injectable in tests only; production endpoints are fixed above.
    GmailApiMail(HttpClient http,URI tokenUri,URI sendUri,String clientId,String clientSecret,String refreshToken) {
        this.http=http;this.tokenUri=tokenUri;this.sendUri=sendUri;
        this.clientId=clientId;this.clientSecret=clientSecret;this.refreshToken=refreshToken;
    }
    private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
    private synchronized String token() throws Exception {
        if(accessToken!=null&&Instant.now().isBefore(refreshAt))return accessToken;
        if(clientId.isBlank()||clientSecret.isBlank()||refreshToken.isBlank())throw new DeliveryFailure();
        String form="grant_type=refresh_token&client_id="+encode(clientId)+"&client_secret="+encode(clientSecret)+"&refresh_token="+encode(refreshToken);
        var request=HttpRequest.newBuilder(tokenUri).timeout(Duration.ofSeconds(8))
            .header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)).build();
        JsonNode result=exchange(request);
        String value=result.path("access_token").asText("");
        long lifetime=result.path("expires_in").asLong(0);
        if(value.isBlank()||lifetime<=0||lifetime>86_400||!"Bearer".equalsIgnoreCase(result.path("token_type").asText("")))throw new DeliveryFailure();
        accessToken=value;refreshAt=Instant.now().plusSeconds(Math.max(0,lifetime-60));return accessToken;
    }
    private synchronized void invalidate(String rejected){if(rejected.equals(accessToken)){accessToken=null;refreshAt=Instant.EPOCH;}}
    private JsonNode exchange(HttpRequest request) throws Exception {
        var pending=http.sendAsync(request,HttpResponse.BodyHandlers.ofByteArray());
        try {
            var response=pending.get(8,java.util.concurrent.TimeUnit.SECONDS);
            if(response.statusCode()<200||response.statusCode()>=300)throw new DeliveryFailure(response.statusCode());
            byte[] bytes=response.body();
            if(bytes.length>MAX_RESPONSE_BYTES)throw new DeliveryFailure();
            return json.readTree(bytes);
        } finally {if(!pending.isDone())pending.cancel(true);}
    }
    void send(SimpleMailMessage message) {
        try {
            var mime=new MimeMessage(Session.getInstance(new Properties()));
            mime.setFrom(new InternetAddress(message.getFrom(),true));
            for(String recipient:message.getTo())mime.addRecipient(Message.RecipientType.TO,new InternetAddress(recipient,true));
            mime.setSubject(message.getSubject(),StandardCharsets.UTF_8.name());
            mime.setText(message.getText(),StandardCharsets.UTF_8.name());mime.saveChanges();
            var output=new ByteArrayOutputStream();mime.writeTo(output);
            String payload=json.writeValueAsString(Map.of("raw",Base64.getUrlEncoder().withoutPadding().encodeToString(output.toByteArray())));
            for(int attempt=0;attempt<2;attempt++){
                String bearer=token();
                var request=HttpRequest.newBuilder(sendUri).timeout(Duration.ofSeconds(8)).header("Authorization","Bearer "+bearer)
                    .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(payload)).build();
                try{if(exchange(request).path("id").asText("").isBlank())throw new DeliveryFailure();return;}
                catch(DeliveryFailure error){if(error.status==401&&attempt==0){invalidate(bearer);continue;}throw error;}
            }
        } catch(InterruptedException error){Thread.currentThread().interrupt();throw new DeliveryFailure();}
        catch(Exception error){throw new DeliveryFailure();}
    }
    // Never retain provider bodies, token-bearing requests, MIME content or causes.
    static final class DeliveryFailure extends RuntimeException {
        final int status;
        DeliveryFailure(){this(0);}
        DeliveryFailure(int status){super("Email delivery is unavailable.");this.status=status;}
    }
}
