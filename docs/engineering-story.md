# Why a publication is independent of its draft

A reader should see the explanation the author shared, even while the author
experiments with the next version. Publishing therefore copies the validated
diagram into a publication record rather than resolving a link to the latest
draft. The backend locks the draft and checks its expected version while making
that copy. Later saves and revision restores update the draft, not the copy.

The tradeoff is duplicated diagram storage and an explicit publish action for
each new public version. This buys predictable links and independent guest remixing.
“Immutable” describes the snapshot content, not perpetual availability: deleting
the source project revokes its publications. No account is needed to play a
publication or edit a local remix; online persistence requires authentication.

## Restoring history without rewriting it

Restore passes an earlier revision's document through the ordinary version-checked
update. It creates a new draft version and retains the earlier revisions. The
publication stays unchanged even when the restored content differs from it.

## Concurrent edits and recovery

Updates use an atomic database update matching both project ID and expected
version. A stale version receives HTTP 409; the client does not silently retry
with the newest version. It retains the local edits and offers **Save as Separate
Copy** so the author can reconcile the two projects deliberately.

The two-tab regression exposed a refresh bug: shared browser storage could combine
one tab's edits with another tab's newer version. Each tab now keeps its diagram
and original version metadata together in session storage. Refreshing that tab
retains its optimistic-lock base. Shared local storage remains the fallback for
new workspaces; it is not cross-device synchronization or durable conflict storage.
Session storage lasts for the tab's browser session. Export important unsaved work
as JSON before closing it. Opening a project explicitly fetches its current server
version; guest remixing creates an independent local workspace.

## Evidence and reproduction

- `tests/studio.spec.ts`, “registers, saves in PostgreSQL, publishes immutable
  playback, and remixes in a fresh browser”: a fresh signed-out context plays the
  snapshot, edits and reloads its remix, and compares the complete publication
  document after draft edits and restoration of different content.
- The same file, “keeps stale-tab edits through a conflict and reload, then saves
  an independent recovery copy”: two real tabs, 409 before and after refresh,
  complete recovery-document comparison, unchanged winning document and version.
- `scripts/check-api.mjs`: real HTTP ownership, stale saves, revision restoration,
  publication and remix checks, including full snapshot equality after restoring
  content different from the publication.
- `backend/src/test`: existing Java integration coverage exercises the backend
  persistence and security rules; no additional backend mechanism was introduced.

Use the local test mailbox and an isolated test database as described in the root
README and CI workflow. Run `npm test`, `npm run build`, `npm run test:api` and
`npm run test:e2e`. `API_URL` can point the API checks at an isolated API; Playwright
uses its configured base URL. Never run account-creating tests against real Gmail.

For a manual demonstration, publish a saved project and open its link signed out.
Edit the draft, then restore a revision with different content: refresh the guest
link and play it again. Remix, edit, and refresh the remix. Separately open a saved
project in two signed-in tabs, save an edit in the first, then try saving the
second. Refresh the second and retry: both attempts should report a conflict.
Save it as a separate copy and reopen the original to confirm both sets of work.
