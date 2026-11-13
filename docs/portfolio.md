# Diagram Studio — portfolio materials

## Demo status and preparation

Repository: https://github.com/TahasCODE/diagram-studio

Local demo: http://localhost:8090/?walkthrough=cache-outage

No public demo URL is available yet. Run `npm.cmd start` from the project folder
and wait for startup; PowerShell users should use `npm.cmd` when `npm.ps1` is
blocked. Publishing the service needs separate hosting/cost approval and the
[post-deploy checks](deployment.md). Do not label localhost a live public demo.

Use a fresh guest browser at desktop width for the following script. It needs no
account, verified email, prepared saved project or artificial API responses.
The cache outage is an interactive explanation, not a live infrastructure fault.

## 60–90 second demo — target 85 seconds

1. **0–8 seconds:** Open the local demo link (or the approved hosted equivalent).
   Click **Start Walkthrough**. Say: “Diagram Studio lets readers explore different
   outcomes on the same technical diagram. This example follows a read request
   when Redis goes down.”
2. **8–25 seconds:** Click **Next Step** three times to reach **Redis is
   unavailable**. Click **Fall back to PostgreSQL**, then **Next Step**. Say:
   “The API can read from PostgreSQL and return the data. The cost is extra latency
   and database work. The timeout number in the notes is illustrative.”
3. **25–42 seconds:** Click **Explore the Other Choice**, **Return a temporary
   error**, then **Next Step**. Say: “Alternatively, it can return 503 to protect
   database capacity. The customer gets no data for this request. The same diagram
   makes that tradeoff visible.”
4. **42–52 seconds:** Click **Restart Walkthrough**, then **Start Walkthrough**.
   Say: “Restart resets the explanation. Guests can try both paths without an
   account, and opening the walkthrough preserves their existing local draft.”
5. **52–72 seconds:** Click **Remix Diagram** in the top bar, then the **Editor**
   inspector tab. Change **Project Title** to “My cache failure flow” and press
   Tab. Say: “A reader can make an independent editable copy. This is my local
   remix; changing it does not change the example.”
6. **72–85 seconds:** Click **Project**, then **Export Project** and accept the
   JSON download if prompted. Say: “Local work can be exported without an account.
   Signed-in authors also get version-checked saves, revision restore and fixed
   publication links. The repository includes tests and a reproducible playback
   benchmark for those engineering claims.”

For an interview follow-up, demonstrate publication/restore and the two-tab
conflict recovery using [the engineering story](engineering-story.md). Do not
try to register, wait for email and explain every backend feature inside the
85-second guest demo. Rehearse the actual clicks before recording; timing is a
target, not a measured recording duration.

## Short case study

**Problem.** Static architecture diagrams show components but leave readers to
imagine how a request behaves when something fails. Authors also have to keep
several similar diagrams consistent when explaining different scenarios.

**Product.** Diagram Studio is a React/TypeScript editor backed by Java 25,
Spring Boot and PostgreSQL. Authors reuse one graph across scenarios, annotate
steps and publish a snapshot. Guests play and remix it without an account. The
cache-outage example asks the reader to choose between PostgreSQL fallback and
a temporary error, then explains availability versus capacity in plain language.
Redis is a component in that example; it is not an application dependency.

**Engineering decision.** Mutable drafts and public snapshots have separate
lifecycles. A version-checked save, revision insertion and audit insertion commit
together. Restore creates a new version; it does not rewrite history. Publishing
copies a locked, version-checked draft so later edits/restores cannot silently
change an explanation somebody already shared. This costs duplicate storage and
requires explicitly publishing a new version. Project deletion revokes its links;
immutable content does not imply indefinite availability.

**Concurrency and access.** PostgreSQL-backed sessions, bcrypt passwords, email
verification, CSRF and owner checks protect private drafts. Two-tab tests exposed
a refresh bug where shared browser storage could combine stale edits with a new
version. Keeping each tab's diagram and version base together preserves the 409
conflict after refresh. The author can deliberately save a separate recovery copy.
Tab-local browser storage is not cross-device synchronization or durable backup.

**Measured change.** Profiling a deterministic 500-node workload identified
connector routing repeated on every playback step. Reusing geometry until nodes,
connections or viewport changed reduced local median step latency from 88.1 to
29.1 ms and p95 from 168.9 to 97.3 ms across 10 loads and 300 updates per variant.
These are headless Chrome paint-opportunity proxies on one Windows machine with
reduced motion and blocked external fonts, not server latency or INP. Results at
100 nodes were mixed; no small-graph or universal startup improvement is claimed.
See [the benchmark and raw samples](../benchmarks/README.md).

**Evidence and limits.** Playwright verifies guest playback/remix persistence,
snapshot independence after different-content restores, two real stale tabs and
large-graph restart/resize behavior. Java tests use a real test PostgreSQL database
for concurrency, transaction rollback and ownership; HTTP checks cover the API.
CI runs frontend, Java, API, browser and Windows startup checks. The release
workflow also checks the packaged app and container assets. Hosted availability,
traffic, multi-replica operation and production SMTP delivery are not established.

## Three CV bullets, with evidence

- Built a React/TypeScript and Java Spring Boot diagram studio with PostgreSQL
  persistence, email-verified accounts, database-backed sessions and owner-scoped
  project access. Evidence: `AuthController.java`, `SecurityConfiguration.java`,
  Flyway migrations, `EmailVerificationIT.java`, `BackendWorkflowIT.java` and
  account/browser regressions.
- Implemented version-checked saves, transactional revision history and restore,
  immutable publications and guest remixing; verified snapshot independence and
  stale-tab recovery using PostgreSQL integration and Playwright tests. Evidence:
  `ProjectService.java`, `tests/studio.spec.ts`, `scripts/check-api.mjs` and
  [the design decision](engineering-story.md).
- Profiled and cached canvas connector geometry, reducing local 500-node playback
  step latency from 88 to 29 ms median (169 to 97 ms p95) in a repeatable 300-update
  benchmark per variant. Evidence: `scripts/benchmark-playback.mjs`,
  `src/components/Canvas.tsx`, and `benchmarks/results/{baseline,after}.json`;
  [conditions and limitations](../benchmarks/README.md) must accompany discussion.

Use these as project bullets, not employment experience. Link to the public
repository now; add a hosted demo link only after deployment and smoke verification.
No PDF or existing CV file is edited by this document.
