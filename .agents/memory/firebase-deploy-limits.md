---
name: Firebase deploy limits on this project
description: What the FIREBASE_SERVICE_ACCOUNT identity can and cannot deploy for mineral-resonance, and how to run firebase-tools reliably.
---

## Rules deploys work; functions deploys are blocked

**Rule:** `firebase deploy --only firestore|storage` (rules) works with the admin-SDK service account — the firebaserules API is already enabled. `--only functions` CANNOT succeed until (a) the project is upgraded to Blaze and (b) the SA gets API-enable + deploy permissions.

**Why:** Observed 2026-07-27: functions deploy hung >10 min on "Enabling now..." for cloudfunctions/cloudbuild/artifactregistry/firebaseextensions APIs. Direct serviceusage GETs return "Permission denied" for the `firebase-adminsdk` SA (it holds only the Admin SDK service-agent role, no Editor), and Cloud Billing shows `billingEnabled: false` (Spark plan). Cloud Functions requires Blaze; API enablement requires serviceusage.services.enable.

**How to apply:** For function work, first have the user (1) upgrade to Blaze in the Firebase console and (2) grant the firebase-adminsdk SA **Editor** + **Service Account User** in Cloud IAM. Then enable speech.googleapis.com and other APIs yourself via serviceusage REST before redeploying. A hung deploy must be killed — it will not error out promptly.

## Running firebase-tools

`npx firebase-tools@14 ...` died silently once (0-byte log, process vanished). Reliable path: `pnpm -w add -D firebase-tools`, then `GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json ./node_modules/.bin/firebase deploy ... --non-interactive --force` (write the SA JSON from the env secret to /tmp first).

## Working functions-deploy recipe (post Blaze + Editor/SA-User grant, done 2026-07-27)

1. Fix the lockfile proxy URLs first — see [replit-lockfile-proxy.md](replit-lockfile-proxy.md); otherwise Cloud Build's `npm ci` crashes.
2. batchEnable APIs via serviceusage REST (cloudfunctions, cloudbuild, artifactregistry, eventarc, run, pubsub, speech…).
3. First gen2 deploy fails while Google provisions service agents (Eventarc 400 / bucket 409) — wait ~3 min and retry, as the CLI says.
4. A failed create leaves a FAILED function shell typed as HTTPS; the next deploy errors "Changing from an HTTPS function to a background triggered function is not allowed". DELETE the shells via the v2 API, wait for the list to empty, then deploy.
5. Run deploys in the FOREGROUND of one shell call — background processes die when the call returns.
7. firebase.json declares codebase "mineral": single-function deploys need `--only functions:mineral:<fn>` — plain `functions:<fn>` aborts with "No function matches given --only filters".
6. Speech v2 batchRecognize: per-file "An internal error occurred" = the Speech service agent (`service-<projectNumber>@gcp-sa-speech.iam.gserviceaccount.com`) can't read the bucket. Grant it `roles/storage.objectViewer` via BUCKET-level IAM — Storage Admin on the SA suffices, no Owner needed. Fixed transcription instantly.
