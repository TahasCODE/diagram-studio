# Portfolio release and deployment

## Current status

The repository is public; the application has **not been deployed publicly**.
The README's walkthrough link is local. Release preparation is not evidence of a
hosted service, real users, uptime or production email delivery. Get explicit
approval of the hosting target, public exposure and any monthly cost before
creating cloud resources, configuring public DNS or deploying. A custom domain
is optional. Do not describe this as a live demo on a CV until the public checks pass.

## Deployment shape

Run one Java 25 application instance and PostgreSQL 18 with persistent storage.
The built React frontend is served by Spring Boot on the **same origin** as the
API. Put a trusted HTTPS reverse proxy or the host's TLS ingress in front of the
app; forward all paths unchanged, including `/p/{id}`, `/api/*`, `/theme.js`,
assets and `/?walkthrough=cache-outage`. No separate static-site rewrite or CORS
configuration is needed. Use a root origin; subpath hosting is not implemented.

Keep the application port private to that proxy. With native Java on a VM, bind
the application using `SERVER_ADDRESS=127.0.0.1` (Spring's standard environment
property) when the proxy runs on the same machine. For containers, the app must
listen inside the container; Compose publishes 8090 only on host loopback, for a
host-level proxy. A separate proxy container needs a deliberate private Docker
network configuration instead. The stock Compose file alone does not provide TLS.

The stock Compose file uses its bundled database; use the native artifact or a
host-specific container configuration for a separately managed database.
Compose keeps the internal app port at 8090; changing it also requires updating
the service's port mapping and forwarded environment.

The app does not enable forwarded-header trust. Let the ingress handle HTTPS
redirects and HSTS. Authentication rate limiting currently keys on the servlet
remote address; a reverse proxy can put readers in one bucket. Configure ingress
abuse controls and assess the local auth budget before launch. Do not blindly
trust client-supplied forwarded IPs. This is a single-instance portfolio demo,
not a claim of distributed rate limiting or high availability.

## Required configuration

Set secrets in the host's environment/secret store, never in Git, a Docker build
argument, command history or the README. Do not print resolved Compose
configuration after real secrets have been supplied.

- `SPRING_PROFILES_ACTIVE=prod` and `COOKIE_SECURE=true`.
- `DB_URL=jdbc:postgresql://<private-db-host>:5432/diagram_studio`, `DB_USER`, and
  a unique `DB_PASSWORD`. Use the database provider's required TLS parameters,
  preferably certificate-verified TLS, when the database is on another host.
  Database credentials need schema-migration privileges for Flyway on startup.
- `MAIL_HOST`, `MAIL_PORT` (587 for the documented Gmail setup), `MAIL_USERNAME`,
  `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_AUTH=true`, `MAIL_STARTTLS=true`.
  Use a dedicated sender and an SMTP application credential. Outbound SMTP must
  be allowed by the chosen host. See [email setup](email-setup.md). Do not deploy
  the local mailbox, expose its ports, or use `.test` sender addresses.
- `SERVER_PORT` if the host requires a different listening port; default 8090.
- `MANAGEMENT_ADDRESS=127.0.0.1`, `MANAGEMENT_PORT=8091` by default. Keep management
  private and out of the public ingress. Optional `STUDIO_OPS_USERNAME` and
  `STUDIO_OPS_PASSWORD` enable protected metrics; leave operator access disabled
  if no private monitoring client is configured.

Production startup rejects missing/development database passwords, insecure
cookies, missing sender credentials/address, test sender domains, or disabled
SMTP authentication/required STARTTLS. These checks validate configuration, not
database backups, sender deliverability or the ingress's TLS setup. Spring still
needs a working database to complete startup.

Native Spring Boot does not automatically read `.env`. Docker Compose does read
its `.env` for interpolation; the Compose app service now forwards the mail
variables. `.env.example` lists keys and contains local defaults, not production
secrets. Set production values through the approved environment before launch.

## Build an immutable release artifact

Use Node 24 and JDK 25. The Maven wrapper is in `backend/`. Run from a clean
checkout of the approved merge commit and record that SHA with the release:

```powershell
npm.cmd ci
npm.cmd test
node scripts/generate-openapi.mjs
git diff --exit-code -- api/openapi.json
npm.cmd run build
./backend/mvnw.cmd -f backend/pom.xml -B --no-transfer-progress clean verify -Pintegration
```

The integration command needs an **isolated test database** and the loopback test
mailbox, never production data or real Gmail. Follow `backend/README.md` and CI
for `STUDIO_TEST_DB_URL` and the local sink. `clean` avoids carrying old bundled
assets or benchmark source maps into the release. Ship
`backend/target/diagram-studio-1.0.0.jar`; it includes frontend assets and the API
contract. Source maps are for local benchmarks, not required for deployment.

After approved secrets, database and HTTPS ingress are ready, the native launch
command is `java -jar diagram-studio-1.0.0.jar`. Use the host's service manager for
restart-on-failure, logs, graceful termination and a deployment-specific memory
budget. Do not run the development launcher, Vite, or the local PostgreSQL
bootstrap script as the production service.

Alternatively, on an approved Docker host:

```text
docker compose build app
docker compose up -d
```

Compose's named `diagram_data` volume persists PostgreSQL data; never run
`docker compose down -v` against a database you intend to retain. Changing
`DB_PASSWORD` after volume initialization does not change the existing PostgreSQL
role password; rotate it deliberately in PostgreSQL and update app configuration.
The Docker build copies `public/` so the first-paint theme script is present and
runs the final JVM as the non-root `studio` user. CI builds and starts this image
against its test database, then checks its routes and assets. Docker is not
installed on the current Windows workstation; local Docker execution is not claimed.

## Data, deployment and rollback

Before a migration, take a database backup using the database host's backup
facility or `pg_dump`, store it privately, and verify restoration to an isolated
database. Retain the previous app artifact and configuration references. Flyway
runs versioned migrations on startup; rollback of the app binary alone does not
undo a schema migration. Assess backward compatibility before reverting a binary;
if restoration is needed, stop writes and restore the tested database backup.
Do not edit applied Flyway migration files or erase database volumes as a fix.

Use database-backed readiness at the private management endpoint
`/actuator/health/readiness`, and liveness at `/actuator/health/liveness`.
`/api/health` is a public application check, **not a substitute for readiness**.
For Compose, management is only reachable inside the app container by default;
use an internal probe or explicitly configured private networking. Monitor failure
rates and request IDs, bounded connection acquisition, SMTP failures, storage and
backup health. Logs must not include account codes, credentials or request bodies.

## Post-deploy smoke checks

Record the deployed SHA, URL, time, migration result and actual check results.
Run the read-only HTTP check from a machine that can reach the approved URL:

```powershell
$env:APP_URL = 'https://<approved-app-host>'
npm.cmd run test:release
# Optional: check one author-created snapshot without altering it.
$env:PUBLICATION_ID = '<existing-publication-uuid>'
npm.cmd run test:release
Remove-Item Env:PUBLICATION_ID -ErrorAction SilentlyContinue
```

The script checks bundled JS/CSS, synchronous theme startup, direct SPA routes,
guest session state, API availability and signed-out project access. It creates
no accounts/projects and sends no mail. It must not be pointed at a subpath URL.
The CI run checks both the packaged JAR and Docker image locally; that does not
establish any public host's configuration.

Then, manually in a fresh signed-out browser:

1. Open `https://<approved-app-host>/?walkthrough=cache-outage`, start it and
   complete both choices using **Explore the Other Choice**. Restart, and confirm
   the choice is required again. On mobile, confirm the start and choices fit.
2. Click **Remix Diagram**, edit the title and refresh. Confirm the local remix
   persists and the original walkthrough is unchanged. Toggle dark mode and
   refresh: no light flash should appear.
3. As the owner, create a controlled account with an address you own. Verify
   actual inbox delivery, sign in, save a project, publish and copy its URL.
   Never put a real code/password into logs or the release record. Existing local
   SMTP tests are not proof of production delivery.
4. Open `/p/{id}` directly in a fresh guest window; play and remix it without
   signing in. Change and restore the author's draft, then refresh the guest
   snapshot to confirm it stays fixed. Check the session cookie has Secure,
   HttpOnly and SameSite=Lax over HTTPS. Check password recovery for the controlled
   verified account, and verify the former session is revoked after reset.
5. Open the same saved draft in two signed-in tabs; save in the first, then save
   the stale tab. Confirm 409, retained edits after refresh and separate-copy
   recovery. Confirm private projects cannot be fetched signed out.
6. From outside the host, verify database and management ports are unreachable;
   check readiness privately and confirm public requests do not expose actuator
   metrics or operator credentials. Validate HTTPS redirection/certificate renewal
   at the ingress and check a database backup can be restored.

After these pass, put the actual HTTPS walkthrough link near the top of README
and the actual demo/snapshot URLs in the portfolio. Keep localhost as a clearly
labelled development option. Never substitute a fictional public link. The CV
PDF is outside this release preparation and is left unchanged.
