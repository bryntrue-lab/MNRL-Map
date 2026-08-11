---
name: Firestore RN transport
description: Web SDK Firestore on React Native can hang for minutes without forced long polling
---
The Firebase **web** SDK's Firestore defaults to WebChannel streaming, which can silently hang on the React Native network stack — screens sit empty for 2–3 minutes until internal retries succeed (seen live: notes + field guide blank on app open).

**Why:** RN's fetch/XHR stack doesn't reliably support the streaming transport; auto-detection doesn't always kick in.

**How to apply:** `lib/firebase.ts` initializes Firestore with `experimentalForceLongPolling: true` on native (web keeps default streaming; try/catch falls back to `getFirestore` on hot reload). Keep this split if the init is ever refactored.
