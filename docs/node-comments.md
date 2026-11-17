# Node comments and review discussions

Node Comments is part of the full account-enabled application only. The hosted
guest app and video remain unchanged. This feature uses explicit refresh, not
real-time notifications or collaborative cursors.

## Try locally

1. Sign in and save a diagram online. Click a comment pin beside a node, or
   **Playback → Node Comments** and choose a node.
2. Post a question or review note. Only nodes present in the saved server draft
   can receive a new discussion. Save newly added nodes before commenting.
3. An accepted project member can open the same node, read and reply. Viewers can
   participate in review without acquiring permission to change the diagram.
4. The author, an Editor or the Owner may resolve or reopen a discussion. Replies
   are blocked while resolved. Refresh Comments loads changes from other members.
5. All Nodes lists discussions across the project, including nodes removed from
   the current draft. The original node label is retained as review context.

Threads and replies are paginated (10 threads / 20 replies by default, API maximum
50 per page). Messages are trimmed plain text, 1-1000 characters. React escapes
their display; there is no HTML rendering, Markdown execution or file upload.
Unconfirmed text stays in the open dialog, including reply drafts when refreshing
or switching threads. Closing the dialog or reloading the page discards unposted
text. A network failure may occur after a write commits: refresh before reposting
an unconfirmed message to avoid duplicates.

## Access and data boundaries

- Accepted Owners, Editors and Viewers may read, start discussions and reply.
- Viewers may resolve/reopen only discussions they authored; Editors and Owners
  may resolve any discussion. There is no message editing or deletion in this release.
- Unrelated, pending and revoked members receive 404. Existing cookie sessions,
  CSRF tokens, body limits and owner-scoped project access are reused.
- Comment mutations acquire the same project row lock used by membership changes,
  so revocation cannot be bypassed by checking permissions before an unlocked write.
- Resolve/reopen uses a separate discussion version and rejects stale changes
  with 409. Comments never increment a diagram's optimistic-save version.
- Comments are private review data in separate tables. They are absent from
  immutable publication documents, guest remixes and JSON/SVG/PNG exports.
- Removing a node retains its discussion; deleting its project cascades to threads
  and replies. Previously downloaded content cannot be recalled by revocation.
- Writes record actor-scoped audit events in the same transaction. There is no
  new email delivery, notification service or dependency.

Evidence: `CollaborationIT.nodeDiscussionsRespectMembershipResolutionAndSnapshotBoundaries`
uses real sessions and PostgreSQL to verify role rules, pending/revoked access,
cross-project isolation, validation, pagination, stale resolution, removed nodes,
publication independence and cascade cleanup. `tests/comments.spec.ts` verifies
the actual two-account review flow, plain-text rendering, conflict recovery,
preserved unsent text, responsive layouts and Viewer permissions. Guest checks
ensure comment controls/routes stay unavailable when accounts are disabled.
