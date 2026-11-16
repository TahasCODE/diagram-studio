# Account email setup

**Not required for the public guest demo.** The deployed Render version disables
accounts and sends no verification or recovery emails. The complete account/email
implementation stays in the project; use this optional guide only when configuring
the full application locally or on a future account-enabled host.

New and existing accounts must verify their email before signing in. Migration V4
signs out existing sessions; existing users choose **Need to Verify Your Email?**
from the sign-in dialog and request a code. Projects are preserved.

Migration V5 also signs out older sessions once to introduce credential versions.
Password changes and **Sign Out All Devices** increment this version and remove
persisted sessions. Every authenticated API request checks it, including sessions
saved by a concurrent login. Requests already authorized before revocation may
finish. Password-change and profile events contain no password or code data.

## Gmail HTTPS API for free Render hosting

The Gmail App Password below authenticates SMTP, which cannot use Render's free
blocked ports. For the hosted app, choose `MAIL_PROVIDER=gmail-api`. The backend
uses Google's HTTPS endpoints, a sender-owned refresh token, and the same
verification/reset messages. Visitors never authorize a Google account. SMTP is
still the default for local development and the isolated CI mailbox.

### One-time sender authorization

Use the dedicated sender's Google account. Production OAuth publishing can require
public branding links and verified domain ownership; do not assume those
requirements can be skipped. Standard Gmail API use has no additional cost; Gmail's account sending
limits and Google API quotas still apply. Do not activate paid cloud products.

1. In Google Cloud Console, create/select **Diagram Studio Mail** and enable the
   **Gmail API**. This is separate from creating a Gmail App Password.
2. Configure Google Auth Platform branding/audience for your sender authorization.
   Use the minimum scope `https://www.googleapis.com/auth/gmail.send`; do not add
   mailbox-reading or modification scopes. Only the owner authorizes this sender.
3. Create a **Web application** OAuth client for a one-time authorization using
   Google's OAuth Playground, with redirect URI
   `https://developers.google.com/oauthplayground`. Keep the downloaded client
   credentials outside Git; do not upload them to chat or commit them.
4. In [OAuth Playground](https://developers.google.com/oauthplayground), enable
   **Use your own OAuth credentials** in settings and enter that client's ID and
   secret. Select offline access, request only `gmail.send`, authorize the
   dedicated sender, then exchange the authorization code for tokens. Using your
   own client is essential: Playground's built-in credentials are temporary.
5. Configure the production OAuth publishing status before obtaining the final
   refresh token. Google's **Testing** status normally expires refresh tokens
   after seven days for this scope. Follow Google's applicable verification or
   exemption rules; do not treat a testing token as a permanent production secret.
6. Store `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and
   `MAIL_FROM` in Render's private environment configuration. `MAIL_FROM` must be
   the authorized sender address (or an authorized Gmail send-as alias). Set
   `MAIL_PROVIDER=gmail-api`. SMTP username/password and STARTTLS settings are not
   required for this provider; the production guard instead requires all three
   OAuth values, a real sender, a database secret and secure cookies.

The backend fixes Google's token/send endpoints in code, uses bounded network
timeouts, caches access tokens until shortly before expiry, and retries once only
after an explicit HTTP 401 rejection. Rate-limit, quota, revoked-token and network
failures return a generic 503; no SMTP fallback or automatic retry of ambiguous
deliveries is attempted. Provider bodies, MIME content and credentials are not
included in exception causes. Never enable HTTP wire logging with these secrets.

Rotate/re-authorize a revoked refresh token through the sender account and update
Render's secrets. Do not put tokens in the frontend, project JSON, URL, logs, or
README. Refresh tokens can still be revoked by Google or the account owner even
after leaving Testing.

### Verification before declaring email ready

Local Java tests exercise fake loopback token/send endpoints, MIME encoding,
token reuse, 401 refresh, quota rejection and revoked credentials. CI's real-HTTP
account tests continue to use the local SMTP sink. Neither establishes inbox
delivery. After configuring the sender, verify signup and password reset using an
address controlled by the owner; check actual inbox delivery, expiry/one-time use,
and session revocation. Keep the public release marked pending until these pass.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[OAuth offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline),
[OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration),
[Gmail quotas](https://developers.google.com/workspace/gmail/api/reference/quota).

## Gmail SMTP for local development

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
