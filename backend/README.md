# Java backend engineering notes

This application is a Java 25 / Spring Boot modular monolith. It uses Spring
MVC, Security, JDBC, Session JDBC, Actuator, Micrometer, PostgreSQL and Flyway.
It deliberately keeps ownership, validation and transactions on the server.

## Account flow

Registration creates an account and leaves the browser signed out. The frontend
shows an account-created confirmation and a sign-in form with the email retained.
Sign-in displays a real pending state, verifies the resulting session, then shows
a success screen until the user selects Continue to Workspace. Failed credentials
leave the form available with a readable error. No artificial authentication
delay or credential storage is added.

Passwords are bcrypt hashes. Sessions are HttpOnly/SameSite cookies backed by
PostgreSQL. The client obtains a CSRF token from `/api/auth/me` for writes.
Application accounts and operational credentials have separate access paths.

## Reliability and observability

- A server-issued `X-Request-ID` correlates responses, MDC logs and audit events.
  Caller-supplied identifiers are not accepted as trusted log identifiers.
- MVC, Spring Security, rate limits and body-size errors use the same RFC 9457
  Problem Details shape. The extra `message` field preserves client compatibility.
  Validation errors identify fields but never echo submitted values.
- Request logs record method, path, status and duration; they omit query strings,
  cookies, passwords and request bodies. Production console logging uses ECS JSON.
  Authentication request records redact their diagnostic string representation,
  preventing framework debug logs from printing passwords or submitted emails.
- Actuator supplies database-backed readiness, liveness, JVM/HTTP/connection-pool
  metrics and Prometheus output. Business event counters increment after commit,
  so a rolled-back write is not counted as successful.
- Shutdown is graceful, database connection acquisition is bounded, and SQL
  statements have a five-second query timeout.

## Management access

The application serves users on port 8090. Management defaults to loopback
`127.0.0.1:8091` and is not published as a host port by Compose.

Health probes are available at `/actuator/health/liveness` and
`/actuator/health/readiness` on the management port. Readiness includes PostgreSQL;
liveness does not depend on database health.

`/actuator/metrics` and `/actuator/prometheus` require HTTP Basic credentials
configured with `STUDIO_OPS_USERNAME` and `STUDIO_OPS_PASSWORD`. Operator access is
disabled while the password is empty. No operational password is shipped. The
operator role is stateless and cannot read private projects. User sessions do not
grant operational access. Use TLS and network restrictions for remote scraping;
if needed, explicitly change `MANAGEMENT_ADDRESS` within a private network.

## Transactional domain behavior

Create/save, revision insertion and audit insertion commit together. The audit
table records only owner/project IDs, action, version, request ID and time. It
does not duplicate document contents or credentials. Audit records survive
project deletion, but remain visible only to their owning account. They are
append-only through the API, not cryptographically tamper-proof against a database
administrator. Retention/archival is a future operational policy.

Optimistic version checks prevent lost updates. Published snapshots are copied
under a row lock. Restoration creates a new saved revision, preserving older
versions. A failed revision/audit write rolls back the draft change.

## Bounded queries and abuse controls

Project lists support page/size and literal case-insensitive title search.
Stable ordering includes the project ID after updated time. Pages and page size
are validated; `%`, `_`, and the SQL escape character are treated literally.
Audit lists are likewise paginated and account-scoped. Count and item queries run
in a repeatable-read transaction so each response uses one database snapshot.

Authentication POSTs share a configurable per-remote-IP fixed-window limit:
`AUTH_MAX_ATTEMPTS` defaults to 30; `AUTH_RATE_WINDOW` defaults to `PT15M`. Rejection
returns 429 and `Retry-After`. The in-memory limiter is bounded to 10,000 keys and
reclaims expired entries. Forwarded-IP headers are not trusted. Multiple replicas
need a shared ingress/distributed limit; this local limiter is not claimed to be
distributed. JSON bodies are capped at 1 MB before deserialization.

## API reference

Open `/api/docs` for the human-readable reference or `/api/openapi.json` for the
OpenAPI 3.1 document. Both are packaged from `api/openapi.json`; the generator is
`scripts/generate-openapi.mjs`. The contract documents account flow, version
conflicts, error responses, pagination, audit ownership and CSRF requirements.

## Profiles and configuration

Default configuration supports native local development. Enable `prod` using
`SPRING_PROFILES_ACTIVE=prod` for ECS JSON logs and secure-cookie defaults.
Production startup rejects the development database password, a missing database
password, or insecure session cookies. Configure environment secrets, HTTPS and
persistent database storage on the actual host. Profiles do not deploy anything.

## Verification and CI

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 verify
npm run test:api
npm run test:e2e
```

`verify` enables the Maven `integration` profile. It uses a real isolated
`diagram_studio_test` PostgreSQL database by default; `STUDIO_TEST_DB_URL` overrides
that URL. HTTP servers use random ports. Fixtures are removed by the test account
ID. Tests cover two simultaneous saves of the same version, deliberate revision
insert failure and rollback, unchanged success metrics after failure, audit
ownership, literal search, operator separation, readiness and rate-limit rejection.
The fixture-only duplicate revision in that test is intentional and must result
in a rolled-back request; its logged SQL error is expected test evidence.

The GitHub Actions workflow builds TypeScript, runs frontend and Java tests with
an isolated PostgreSQL service, checks generated OpenAPI drift, runs API/browser
regressions and uploads diagnostic reports. Hosted runs have passed on the public
repository's merged release-preparation
PRs; see GitHub Actions for each actual commit. Release checks also exercise the
packaged frontend routes/assets and build/start the non-root Docker image. This
does not establish a public app deployment. See [the deployment guide](../docs/deployment.md).

## Accurate resume positioning

You can demonstrate a Java full-stack project with authenticated ownership,
PostgreSQL JSONB persistence, Flyway migrations, durable revisions, immutable
publishing, optimistic concurrency, transactional audit, protected operational
metrics, standardized errors, request correlation and integration tests.
Explain those design decisions and the tests that establish them. Do not claim
traffic, latency, uptime, compliance, distributed operation or cloud deployment
without measurements and an actual deployment.

Email verification and password recovery are implemented and tested using the
local SMTP sink; see [email setup](../docs/email-setup.md). Real production inbox
delivery must be verified separately on the chosen host. Real-time collaboration, distributed tracing,
centralized log collection and a hosted Prometheus/Grafana service remain future
integrations. The existing 15-page PDF documents the earlier application snapshot;
these engineering notes describe the subsequent backend additions.
