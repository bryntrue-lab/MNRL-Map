---
name: Firebase project config via Admin APIs
description: Anonymous auth provider state and how to change project-level Firebase settings programmatically with the service account.
---

# Firebase project configuration (mineral-resonance)

Anonymous sign-in is **enabled** (turned on 2026-07-27; it was disabled and every
`signInAnonymously` call failed with HTTP 400 `ADMIN_ONLY_OPERATION`, which surfaced
as the app's "no connection" timeout valve).

**Rule:** provider toggles and other project-level auth settings do NOT require the
Firebase console — the Identity Toolkit Admin API works with the service account:

- Mint an OAuth token from `FIREBASE_SERVICE_ACCOUNT` (RS256 JWT → oauth2.googleapis.com/token,
  scope `identitytoolkit` and/or `cloud-platform`; plain node:crypto suffices, no SDK needed).
- `PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/{pid}/config?updateMask=signIn.anonymous.enabled`
  with `{ "signIn": { "anonymous": { "enabled": true } } }`.
- Firestore admin reads/writes for test setup: `firestore.googleapis.com/v1/...:runQuery` / PATCH
  with `updateMask.fieldPaths=<field>` (scope `datastore`).

**How to apply:** whenever a Firebase auth feature fails with a 4xx that looks like a
provider/config issue, check and fix it via these APIs instead of asking the user to
open the console. Quick provider probe: `POST /v1/accounts:signUp?key=$EXPO_PUBLIC_FIREBASE_API_KEY`
→ `ADMIN_ONLY_OPERATION` means the anonymous provider is off.

**Operator identity verification:** Verify the returned Firebase ID token and compare its verified UID with the authorized target before invoking self-only callables.

**Why:** Identity Toolkit custom-token exchange can succeed without a `localId` response field. Treating that optional field as identity proof incorrectly rejects a valid session.

**How to apply:** Use Admin Auth token verification in operator scripts; never log the token or replace verification with a successful HTTP status alone.
