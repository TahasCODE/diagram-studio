# Contributing

The first commit imports the existing application as a working baseline. Earlier
development was not tracked in Git. New work should use real branches, commits,
pull requests and verification results; do not reconstruct a fictional history.

## Make a change

1. Update `main` with `git switch main` and `git pull --ff-only`.
2. Create a focused branch, for example `git switch -c fix/session-feedback`.
3. Implement one coherent change. Keep credentials, database files, build output
   and personal IDE settings out of Git.
4. Run the checks relevant to the change and inspect `git diff --check` and
   `git diff`. Commit with a message explaining the resulting behavior.
5. Push with `git push -u origin HEAD` and open a pull request targeting `main`.
6. Describe the problem, behavior and actual validation results. Inspect the diff
   and the GitHub Actions run. Fix failures on the same branch before merging.
7. Merge after verification passes, then update local `main` and remove the
   completed branch. Use a merge commit when preserving branch history matters.

Solo contributors can review their own diff, but must not claim an independent
review or invent approvals. A passing workflow is evidence of automated checks,
not a guarantee that the application is ready for production.

## Verification

Use Node.js 24, Java 25 and PostgreSQL 18. See the root README and backend README
for local database and server setup.

```powershell
npm ci
npm test
node scripts/generate-openapi.mjs
git diff --exit-code -- api/openapi.json
npm run build
npm run backend -- verify
```

The backend wrapper's `verify` action includes PostgreSQL integration tests;
configure `STUDIO_TEST_DB_URL`, `DB_USER` and `DB_PASSWORD` for an isolated test
database. With the packaged application running on port 8090, also run:

```powershell
npm run test:api
npx playwright install chromium
npm run test:e2e
```

The **Verify Full Stack** workflow runs frontend checks, Java tests with a real
PostgreSQL service, API checks and browser checks on pushes and pull requests.
Open its actual result before merging. Repository branch protection, when enabled
and supported by the account plan, provides enforcement; this guide alone does not.

## Document changes

Update the API contract when behavior changes, add meaningful regression coverage
for fixes, and describe user-facing changes under `Unreleased` in `CHANGELOG.md`.
Never commit real production credentials or customer data. If a credential leaks,
revoke it; deleting it in a later commit does not remove it from Git history.
