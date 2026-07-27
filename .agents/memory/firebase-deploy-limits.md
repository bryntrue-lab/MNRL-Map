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
