# Diagram Studio API contract

Registration sends a six-digit verification code. Correct-password sign-in returns
403 until verified. POST `/auth/verify-email` accepts `{email,code}` and returns 204
without signing in. POST `/auth/resend-verification` accepts `{email}`, returns a
generic message and sends at most once per minute. Codes expire in ten minutes,
permit five guesses and are single-use. Both endpoints require CSRF. SMTP failure
returns 503. See `docs/email-setup.md` for sender configuration.

All endpoints are under `/api`. JSON bodies are limited to 1 MB. Errors use
`{ "message": "human-readable reason" }` with the appropriate HTTP status.

Authentication uses an HttpOnly, SameSite=Lax session cookie. GET `/auth/me`
returns `{ user: { id, name, email } | null, csrfToken }`. Send that token in
`X-CSRF-TOKEN` on every POST, PUT, or DELETE. Call `/auth/me` again after logout.
Credentials are never stored in browser storage. Production must enable secure
cookies and use HTTPS on one origin for the frontend and API.

- POST `/auth/register`: `{name,email,password}` → 201 account. Does not sign in;
  submit credentials to `/auth/login` after registration. Names 1–80 chars;
  canonicalized unique emails up to 254 chars; passwords 10–72 UTF-8 bytes.
- POST `/auth/login`: `{email,password}` → 200 user or 401 generic rejection.
- POST `/auth/logout`: revoke current session → 204.
- GET `/health`: 200 if database is reachable, 503 otherwise.
- GET `/projects?page=0&size=12&q=`: authenticated owner's project page
  `{items,page,size,total,totalPages}`. Page starts at 0, size is 1–50, and optional
  title search is literal, case-insensitive text (maximum 80 characters).
- POST `/projects`: `{document}` → 201 `{id,version,updatedAt,document}`.
- GET `/projects/{id}`: authenticated owner's full draft, same shape.
- PUT `/projects/{id}`: `{version,document}` → updated draft and incremented
  version. 409 means someone else saved first; fetch or save a separate copy.
- DELETE `/projects/{id}?version=n`: authenticated owner, matching version → 204.
  Published snapshots belonging to that project are also revoked.
- POST `/projects/{id}/publications`: `{version}` → 201 `{id,createdAt,title}`.
  Must match the stored draft version. Each call creates a new immutable snapshot.
- GET `/projects/{id}/publications`: owner's latest 50 publication summaries.
- GET `/projects/{id}/revisions`: owner's latest 100 saved revision summaries
  `{version,title,createdAt}` in descending version order.
- GET `/projects/{id}/revisions/{version}`: owner's saved revision, including
  `document`. Other owners and missing versions return 404.
- POST `/projects/{id}/restore`: `{version,revisionVersion}` → 200 draft.
  `version` must match the current draft; `revisionVersion` identifies the saved
  content to restore. Appends a new revision and never rewrites older revisions
  or published snapshots. Stale current versions return 409.
- GET `/publications/{id}`: public `{id,title,createdAt,document}`. Does not expose
  ownership or draft data. Review flags are removed when publishing.
- POST `/publications/{id}/remix`: signed-in reader → 201 independent owned draft.

Private resources return 404 for both nonexistent and non-owned IDs. Unauthenticated
access to private endpoints returns 401; absent/invalid CSRF tokens return 403.
Invalid diagrams return 400; duplicate email returns 409.

A document is `{title?,nodes,scenarios}`. Nodes have unique nonempty `id`, `label`,
numeric `x`/`y` within 0–100, and optional `notes`. Scenarios have `name`, an ordered
`steps` array of existing node IDs (repetitions allowed), optional `description`,
and optional `review` strings. At least one scenario is required; empty graphs and
empty scenario routes are allowed. Limits: 250 nodes, 100 scenarios, 500 steps per
scenario; title 80, node labels 48, scenario names 48, notes/descriptions 2,000 chars.

`api/openapi.json` is the machine-readable API source of truth. Local browser and
HTTP integration tests validate real Spring Boot requests against PostgreSQL.

## Operations, observability and audit

Every response includes `X-Request-ID`. API errors use `application/problem+json`
with `type,title,status,detail,instance,requestId` and backward-compatible
`message`. Validation errors may include safe field messages; submitted values
are never echoed. Request logs include method, path, status, duration and request
ID, never passwords, cookies or request bodies.

Authentication POSTs are limited per remote IP per process. Exceeding the
configured window returns 429 and `Retry-After`. Forwarded IP headers are not
trusted; a multi-instance deployment should enforce a shared limit at its ingress.

- GET `/activity?page=0&size=20&projectId=`: authenticated owner's paginated audit
  events `{id,projectId,action,version,requestId,createdAt}`. Deleted-project events
  are retained. No document content or credentials are written to audit records.
- GET `/openapi.json`: public machine-readable API reference.
- GET `/docs`: public HTML API reference.

Actuator runs on a separate loopback management port (8091 by default). Health,
liveness and database-backed readiness are public on that port; metrics and
Prometheus require an explicitly configured operator credential. Operators use
stateless HTTP Basic authentication and cannot edit users' projects. Application
accounts cannot access operator metrics. Management ports are not published by
the Compose application service.
