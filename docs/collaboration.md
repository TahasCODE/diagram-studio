# Shared project access (full application)

The full account-enabled application supports asynchronous project collaboration.
The deployed guest demo and its video are unchanged; collaboration is unavailable
when `ACCOUNTS_ENABLED=false`. This is shared access with explicit version-checked
saves, not live simultaneous editing, presence or automatic merging.

## Try it locally

1. Start the full application and sign in with an existing verified account.
2. Save a project online. Choose **Collaborate**, or **Projects → Manage Access**.
3. Enter another verified account's email and choose Editor or Viewer. Invitations
   appear in that account's **Collaborate → Your Invitations** inbox. No mail is
   sent and no project access is granted before acceptance.
4. In another browser profile, sign in as the recipient, accept and open the project.
5. As Viewer, play scenarios and inspect history. As Editor, edit and save or restore.
6. From the owner account, change the role or remove access. New server requests
   immediately enforce the permission change, even from a stale browser tab.

| Action | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| Open/play, read revisions and publication list | Yes | Yes | Yes |
| Save and restore with expected version | Yes | Yes | No |
| Invite, change roles, revoke invitations/access | Yes | No | No |
| Publish or delete the shared project | Yes | No | No |
| Save an independent owned copy | Yes | Yes | Yes |

Owner is the existing project's owner, not an assignable membership role. This
release has no ownership transfer. Pending recipients can accept or decline only
their own invitations. Removed invitations can be sent again. A role change
does not rewrite a public snapshot or alter its availability; deleting a project
still revokes its publication links.

## Engineering and evidence

Migration V6 adds unique `(project_id,user_id)` memberships with a constrained role
and explicit acceptance. Lists include only owned or accepted shared projects.
Unrelated, pending and revoked readers get 404; accepted members lacking a write
permission get 403. Cookie sessions and CSRF also protect membership writes.
Only the owner can see member email addresses or look up an invitation target.

Permission changes, saves, restores and publications lock the same project row
before checking access. This serializes a save with revocation/downgrade; a request
authorized before revocation may finish first, but a subsequent write cannot use
stale permissions. Optimistic versions still reject conflicting document changes
with 409, preserving the existing separate-copy and conflict-review recovery.
Invitations and access changes record actor-scoped audit events transactionally.

Revocation prevents future server access, not reading an already downloaded copy.
Browser-local drafts remain available for recovery. Shared editors must explicitly
open/reload to refresh their diagram and access display; this is not real-time sync.
Invitation lookup requires an existing verified account and can reveal to an
authenticated project owner whether an address is eligible. Do not use it as a
public account-discovery endpoint.

`CollaborationIT` exercises real HTTP sessions and PostgreSQL for pending access,
accept/decline, cross-account denial, role changes, revocation, publication
independence, cascading membership deletion and concurrent Owner/Editor saves.
`tests/collaboration.spec.ts` covers the actual invitation UI, Viewer playback,
Editor saving and retention of unsaved edits after revoked access. `GuestDemoIT`
checks the inbox is inaccessible in guest mode. API routes are in `api/openapi.json`.

CV line, after these checks pass:

> Implemented shared-project collaboration with in-app invitations, Owner/Editor/Viewer permissions and version-checked saves, verified through PostgreSQL integration and multi-user browser tests.
