package com.diagramstudio;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AuthCredentialRedactionTest {
    @Test void resetCannotLeakCodeOrPassword(){
        var diagnostic=new AuthController.ResetPassword("private@example.test","123456","PrivatePassword123").toString();
        assertFalse(diagnostic.contains("123456"));assertFalse(diagnostic.contains("PrivatePassword123"));assertFalse(diagnostic.contains("private@example.test"));
    }
    @Test void passwordChangeCannotLeakCredentials(){
        var diagnostic=new AuthController.ChangePassword("OldSecretPassword","NewSecretPassword").toString();
        assertFalse(diagnostic.contains("OldSecretPassword"));assertFalse(diagnostic.contains("NewSecretPassword"));
    }
    @Test void registrationCannotLeakCredentialsThroughDiagnosticToString() {
        String diagnostic=new AuthController.Register("Private Name","private@example.test","SecretPassword123").toString();
        assertFalse(diagnostic.contains("SecretPassword123"));assertFalse(diagnostic.contains("private@example.test"));assertTrue(diagnostic.contains("REDACTED"));
    }
    @Test void loginCannotLeakCredentialsThroughDiagnosticToString() {
        String diagnostic=new AuthController.Login("private@example.test","SecretPassword123").toString();
        assertFalse(diagnostic.contains("SecretPassword123"));assertFalse(diagnostic.contains("private@example.test"));assertTrue(diagnostic.contains("REDACTED"));
    }
}
