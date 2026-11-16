# Changelog

## Gmail HTTPS delivery
- Added sender-owned Gmail API delivery for free hosting, with cached token refresh, bounded network waits and safe failure responses; local SMTP remains the default.
- Added isolated transport tests and production configuration checks. Actual Google authorization and inbox delivery remain pending.

## Unreleased

- Add a signed-in header Log Out control next to the save status, using the existing confirmation and preserving the local diagram.

- Add three-way save-conflict review with explicit field choices, safe non-overlapping merges, structural/size validation, local backup/copy recovery and version-checked reviewed saves.

- Add visual saved-revision versus current-draft comparison with graph highlights, field details, unsaved-edit awareness and read-only comparison checks.

- Prepare deployment/smoke instructions and evidence-backed portfolio materials; include theme assets and SMTP settings in container deployment, test production guards, and smoke-check packaged/container releases in CI.

- Add reproducible 100/500-node playback benchmarks, align the project limit at 500 nodes, and reuse connector geometry between playback steps based on profiling.

- Apply the saved theme before the application bundle loads to prevent a light flash when refreshing dark mode.

- Keep each tab's unsaved diagram and save version together across refreshes; verify conflict recovery, guest remix persistence and publication independence after restoration.

- Add a guest cache-outage walkthrough with two response choices, explanatory outcomes and restart, using the existing diagram/player model.

- Redesign the workspace with a shared light/dark design system, responsive inspector, polished graph routing, zoom/minimap controls and accessible notifications.

- Show incorrect-current-password errors beneath the field, focus it for correction and clear the error while editing.

- Fix competing Windows database launches, preserve startup logs and recheck connectivity after builds; add Windows lifecycle CI.

- Add password recovery through email codes and a secure local Gmail SMTP launcher.

- Add Account Settings, display-name editing, password changes, security activity and sign-out everywhere.

- Require email verification with expiring single-use codes and Gmail SMTP support.

- Add a contribution guide and pull request template for future changes.

## Initial repository import — 2026-11-12

The existing application was imported as a single baseline commit. This entry
describes that snapshot; it does not imply earlier releases or pull requests.

- React and TypeScript diagram editor with scenario playback and public remixes.
- Java 25 and Spring Boot API with PostgreSQL persistence and Flyway migrations.
- Account registration, session authentication, CSRF protection and project ownership.
- Versioned drafts, immutable publications, revision history and restoration.
- Audit events, request tracing, operational endpoints and production configuration checks.
- Frontend, Java, database integration, API and browser regression checks, plus CI.

## Diagram images and scenario impact review
- Added guest-accessible SVG/PNG downloads with preview, transparent backgrounds, light/dark appearance and playback highlighting. No new dependencies.
- Extended the existing scenario review notes into a discoverable workspace queue, per-path acknowledgement and direct step playback. Existing JSON persistence and publication isolation are reused.

## PNG export decoding fix
- Reuse the CSP-compatible SVG preview source for PNG rasterization. Keep the packaged image security policy unchanged.
- Exercise browser image downloads under the image directive read from the backend security configuration.

## Presentation mode
- Added distraction-free presentation using the existing read-only canvas and scenario player, with larger notes, keyboard navigation, preserved branch gating, optional browser full screen and responsive auto-fit.
- Capitalized the workspace header to Personal Workspace.

## Playback visual polish
- Refined the current-step card with a separate progress badge, clear node headline and a subtle brand accent in both themes. Playback behavior is unchanged.

## Email-free guest deployment
- Added an explicit account-disabled deployment mode with server-side account/draft guards and browser capability discovery.
- Preserved local editing, snapshot links, export, remix and presentation; full account mode remains the default.
- Added guest-mode integration/browser checks and updated the session API contract.
