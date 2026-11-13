# Changelog

## Unreleased

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
