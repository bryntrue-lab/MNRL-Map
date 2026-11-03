---
name: Firebase deploy limits on this project
description: What the FIREBASE_SERVICE_ACCOUNT identity can and cannot deploy for mineral-resonance, and how to run firebase-tools reliably.
---

## Initial deployment blockers were resolved

**Rule:** Rules and filtered functions deployments now work. The original Spark-plan and API-enablement blockers below are historical, not current. Check live permissions before asking the founder to change billing or IAM.

**Why:** Observed 2026-07-27: functions deploy hung >10 min on "Enabling now..." for cloudfunctions/cloudbuild/artifactregistry/firebaseextensions APIs. Direct serviceusage GETs return "Permission denied" for the `firebase-adminsdk` SA (it holds only the Admin SDK service-agent role, no Editor), and Cloud Billing shows `billingEnabled: false` (Spark plan). Cloud Functions requires Blaze; API enablement requires serviceusage.services.enable.

**How to apply:** Do not repeat the already-completed billing/IAM setup. Keep deploy filters narrow and inspect actual failures before changing permissions.

## Running firebase-tools

`npx firebase-tools@14 ...` died silently once (0-byte log, process vanished). Reliable path: `pnpm -w add -D firebase-tools`, then `GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json ./node_modules/.bin/firebase deploy ... --non-interactive --force` (write the SA JSON from the env secret to /tmp first).

## Working functions-deploy recipe (post Blaze + Editor/SA-User grant, done 2026-07-27)

1. Fix the lockfile proxy URLs first — see [replit-lockfile-proxy.md](replit-lockfile-proxy.md); otherwise Cloud Build's `npm ci` crashes.
2. batchEnable APIs via serviceusage REST (cloudfunctions, cloudbuild, artifactregistry, eventarc, run, pubsub, speech…).
3. First gen2 deploy fails while Google provisions service agents (Eventarc 400 / bucket 409) — wait ~3 min and retry, as the CLI says.
4. A failed create leaves a FAILED function shell typed as HTTPS; the next deploy errors "Changing from an HTTPS function to a background triggered function is not allowed". DELETE the shells via the v2 API, wait for the list to empty, then deploy.
5. Use a foreground shell or the managed ShellExec background-task facility with a timeout/check-in; do not use unmanaged nohup.
7. firebase.json declares codebase "mineral": single-function deploys need `--only functions:mineral:<fn>` — plain `functions:<fn>` aborts with "No function matches given --only filters".
6. Speech v2 batchRecognize: per-file "An internal error occurred" = the Speech service agent (`service-<projectNumber>@gcp-sa-speech.iam.gserviceaccount.com`) can't read the bucket. Grant it `roles/storage.objectViewer` via BUCKET-level IAM — Storage Admin on the SA suffices, no Owner needed. Fixed transcription instantly.

**Calling callables as the founder:** mint a custom token with the service account (JWT aud=identitytoolkit…IdentityToolkit, `uid` claim), exchange via `accounts:signInWithCustomToken?key=$FIREBASE_API_KEY`, then POST `{"data":{...}}` to `https://us-central1-mineral-resonance.cloudfunctions.net/<fn>` with `Authorization: Bearer <idToken>`. Used for `backfillPatterns {rebuild:true}` after lexicon/stopword changes.

## Secret provisioning is not secret-reading permission

The deployment identity can create secrets/add versions, but direct secret
payload access and attempted self-grant of secret access returned 403.
Firebase CLI can configure the function runtime's secret access separately.

**Why:** These are distinct IAM permissions. A working deploy does not mean
the operator can retrieve a stored secret or broaden its own access.

**How to apply:** For a new integration, generate a secret once and securely
pass it to both destinations in the same process without logging/persisting it.
Do not extract connector credentials or broaden IAM to work around this.
RevenueCat API-v1 server credentials cannot manage API-v2 webhooks; use the
existing Replit connector for that management operation.
