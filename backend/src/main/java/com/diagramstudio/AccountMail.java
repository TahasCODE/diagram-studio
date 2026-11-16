package com.diagramstudio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AccountMail {
    private final JavaMailSender sender;
    private final String from;
    private final GmailApiMail gmail;
    private final boolean useGmail;
    public AccountMail(JavaMailSender sender, GmailApiMail gmail, @Value("${studio.mail.from}") String from,
                       @Value("${studio.mail.provider:smtp}") String provider) {
        if(!"smtp".equals(provider)&&!"gmail-api".equals(provider))throw new IllegalStateException("Unsupported mail provider.");
        this.sender = sender; this.from = from;this.gmail=gmail;this.useGmail="gmail-api".equals(provider);
    }
    public void sendCode(String email, String code, String purpose) {
        var message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(email);
        boolean reset = "RESET_PASSWORD".equals(purpose);
        message.setSubject(reset ? "Reset your Diagram Studio password" : "Verify your Diagram Studio email");
        message.setText("Your " + (reset ? "password reset" : "email verification") + " code is: " + code
            + "\n\nThis code expires in 10 minutes and can be used once. Never share it."
            + "\nIf you did not request this, you can ignore this email.\n\nDiagram Studio");
        try { if(useGmail)gmail.send(message);else sender.send(message); }
        catch (MailException | GmailApiMail.DeliveryFailure error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Email delivery is unavailable. Please try again later.");
        }
    }
}
