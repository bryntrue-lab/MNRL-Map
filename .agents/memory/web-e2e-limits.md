---
name: Web e2e limits for Mineral testing
description: What the Playwright testing subagent cannot exercise in this environment, and the working equivalents.
---

**Rule:** The testing subagent cannot pass Chromium launch flags, so there is no fake microphone device (`--use-fake-device-for-media-streams`). Granting mic *permission* is not enough — `getUserMedia` fails with no device, so voice recording always takes the app's quiet fallback to type mode on web e2e.

**Why:** Confirmed 2026-07-27; tester replied "unable — no launch-arg control" when asked to relaunch with fake-device flags.

**How to apply:** Treat the quiet type-mode fallback as the *verifiable* web behavior for recording. Verify the voice pipeline server-side instead: admin-upload a WAV (ffmpeg is available; encounter MP3s in Storage make good speech sources) + create a pending note doc, then watch the transcription function settle it. Firestore/Storage **rules** are best verified with REST probes (anon signUp → commit/upload with the exact allowed and denied shapes) — this catches path mismatches the UI never exercises.

Also: Expo typed routes — after adding a new route file, `tsc` fails on `router.push("/new-route")` until the dev server regenerates `.expo/types`; restart the workflow and wait a few seconds before trusting that error.
