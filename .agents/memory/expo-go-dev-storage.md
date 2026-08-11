---
name: Expo Go dev storage + notification scheduling
description: Why device-local state resets between Replit sessions in Expo Go, and iOS backgrounding rules for notification rescheduling.
---

- Expo Go sandboxes AsyncStorage **per experience URL**. The Replit dev domain changes each workspace session, so every new session = blank device storage in Expo Go: flags, cached settings, and any "never re-prompt" latches reset. **How to apply:** dev-session resets of AsyncStorage-backed state are an Expo Go artifact, not a production bug; durable per-user state must be mirrored to the user's Firestore doc and restored on sign-in (gate restore on the LIVE snapshot — `loading === false` in UserContext — not the cache-hydrated profile, and re-check local presence before the restore write).
- **Why:** founder's sunrise notifications never delivered + permission screen re-prompted; root causes were the storage sandbox reset plus cancel-before-compute rescheduling.
- iOS suspends JS seconds after backgrounding. Never rebuild a notification queue on backgrounding, and never `cancelAllScheduledNotificationsAsync()` before the replacement set is fully computed (compute-then-swap). Rebuild only on cold start + transitions to `active`.
- Use the result of `requestPermissionsAsync()` directly at the accept moment; iOS provisional reads as `granted: false`.
- Expo Go on Android SDK 53+ does not support notifications at all — device QA for notifications is iOS-only.
- pnpm strict isolation: Metro needs userland node-core polyfills (`assert`, potentially `buffer`/`events`/`util`) as **direct** deps when a transitive package requires them ("X could not be found" from node core module) — one `pnpm add`, clear Metro cache, restart.
- Privacy law for the morning call: coordinates NEVER leave the device; only `{ mode, hour? }` + offered flag are mirrored to the user doc.
