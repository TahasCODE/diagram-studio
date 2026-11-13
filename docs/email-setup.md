# Account email setup

New and existing accounts must verify their email before signing in. Migration V4
signs out existing sessions; existing users choose **Need to Verify Your Email?**
from the sign-in dialog and request a code. Projects are preserved.

Migration V5 also signs out older sessions once to introduce credential versions.
Password changes and **Sign Out All Devices** increment this version and remove
persisted sessions. Every authenticated API request checks it, including sessions
saved by a concurrent login. Requests already authorized before revocation may
finish. Password-change and profile events contain no password or code data.

## Gmail

The simplest local launcher prompts for both the sender and its App Password:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-gmail.ps1
```

Stop any existing Diagram Studio server first. The launcher keeps credentials in
the process environment while the server runs and restores the previous environment
afterwards. It does not write credentials to disk. The sender must have Google
2-Step Verification and an App Password configured. The manual alternative follows.

Enable Google 2-Step Verification and create an App Password for the sender account.
Set these variables in the terminal that starts the application:

```powershell
$env:MAIL_HOST = 'smtp.gmail.com'
$env:MAIL_PORT = '587'
$env:MAIL_USERNAME = 'your-sender@gmail.com'
$env:MAIL_FROM = 'your-sender@gmail.com'
$env:MAIL_AUTH = 'true'
$env:MAIL_STARTTLS = 'true'
$mailSecret = Read-Host 'Gmail App Password' -AsSecureString
$env:MAIL_PASSWORD = [System.Net.NetworkCredential]::new('', $mailSecret).Password
npm start
```

Never paste the password into chat or source code. After stopping the server,
clear it with `Remove-Item Env:MAIL_PASSWORD`. `.env.example` lists variable names;
the application does not automatically load `.env`. Use a dedicated sender.

See [Google SMTP documentation](https://developers.google.com/workspace/gmail/imap/imap-smtp)
and [App Password instructions](https://support.google.com/accounts/answer/185833).
Google account policy may restrict App Password availability.

Production requires authenticated TLS mail configuration. SMTP operations have
five-second timeouts. Codes are never returned by the application or logged.
SMTP failure returns 503 and rolls back registration. SMTP acceptance does not
guarantee inbox placement; check spam. Real Gmail delivery needs a separate check
after configuring credentials.

## Development and CI

Run `node scripts/test-mailbox.mjs` in a separate terminal. With mail variables
unset, the application uses this loopback-only SMTP sink on port 1025. Open
http://127.0.0.1:8025 and enter the recipient to inspect mail. No real email is sent.
Never deploy this test process or expose its ports. CI uses the same sink.

Codes expire after ten minutes, are bcrypt hashed, allow five guesses, and are
consumed atomically. Resends have a database-backed 60-second cooldown and replace
the prior code. Auth endpoints also have a per-IP limit. Resend replies are generic
for all addresses. Registration retains the duplicate-email 409 response.

## Password recovery

Choose **Forgot Password?** from Sign In. Enter the verified account email, then
the reset code and a new password. Unknown and unverified emails receive the same
acknowledgement without a reset email. A reset code expires after ten minutes and
five guesses, is purpose-bound and single-use. Resending replaces it after the
60-second cooldown. Successful recovery revokes every session and records a
`PASSWORD_RESET` security event; it does not sign in automatically. Email
verification codes cannot reset a password. SMTP failures return 503.
