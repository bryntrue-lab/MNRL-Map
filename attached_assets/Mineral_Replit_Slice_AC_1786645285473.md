# Mineral — Slice AC: Native App Check (App Attest)

*Self-contained slice. Run paired with the first TestFlight build (its acceptance depends on one). Standing instruction applies: this slice touches App Check initialization, the Expo config, and dependencies — nothing else. No screen code, no data layer, no enforcement changes.*

## 0. Context (why this slice exists)

`lib/firebase.ts` currently initializes App Check **on web only** (reCAPTCHA v3) and early-outs on native — its own comment says native attestation is deferred. Consequence: **flipping App Check enforcement in the Firebase console today would break the iOS app entirely** — every Firestore/Storage request from a device would be rejected as unattested. The App ID's App Attest capability is already registered (portal work done); this slice adds the client side, so the enforce-day sequence becomes possible: TestFlight → observe attestation metrics → enforce.

## 1. Decisions already made

1. iOS uses **App Attest** (DeviceCheck fallback for old devices is automatic). Android/Play Integrity may ride along if the chosen library provides it for free; it is NOT required by this slice.
2. Development and simulator builds use the **App Check debug provider** with a registered debug token — dev clients must keep working.
3. **No enforcement change anywhere in this slice.** Enforcement is a console action taken later, per the enforce-day checklist (§5), which is not part of this task.
4. Web behavior (reCAPTCHA v3 path) is unchanged.

## 2. Implementation

- Add a native App Check provider compatible with **EAS builds via config plugin** — preferred: `expo-firebase-app-check` (or an equivalent maintained config-plugin library; if none is viable with the Firebase JS SDK, implement a `CustomProvider` for `firebase/app-check` backed by a small native module that returns App Attest tokens). Whatever the mechanism, it must not require ejecting and must not replace the Firebase JS SDK elsewhere in the app.
- In `lib/firebase.ts`, replace the `if (Platform.OS !== "web") return;` early-out in `initAppCheck()` with the native path:
  - Production/TestFlight builds → App Attest provider, `isTokenAutoRefreshEnabled: true`.
  - Dev/simulator builds (detect via `__DEV__` or an env flag) → debug provider; log the debug token to the console on first run so the founder can register it (Firebase console → App Check → Apps → Manage debug tokens).
- App Check must initialize **before** the first Firestore/Storage/Functions call — verify the module init order in `lib/firebase.ts` (initialize App Check immediately after `initializeApp`, before the service getters are first used).
- `app.json`: any config-plugin entries the library requires; confirm `ios.bundleIdentifier` is `com.madebymineral.quartz` (App Attest is bound to the App ID).
- Firebase console prerequisite (founder, 2 minutes): App Check → register the iOS app with App Attest as the attestation provider (and keep enforcement OFF).

## 3. Acceptance

- [ ] Dev client / simulator: app functions normally; debug token printed; token registered in the console; App Check metrics show verified requests from the debug provider.
- [ ] TestFlight build on a physical device: app functions normally; within minutes, Firebase console App Check metrics show **verified requests attributed to App Attest** for Firestore and Storage.
- [ ] Web: unchanged (reCAPTCHA v3 requests still attest when the site key is present).
- [ ] Enforcement remains OFF on Firestore, Storage, and Functions — verify the console toggles were not touched.
- [ ] No changes outside: App Check init, config files, dependencies. File list in the checkpoint summary confirms.

## 3b. Riders (from the 2026-08 pre-TestFlight audit — two one-line fixes, nothing more)

1. `app/morning-call.tsx` `wheelText`: color `rgba(255,255,255,0.45)` violates the 0.5 alpha floor → `Colors.textMuted`.
2. `app/lens/[lens].tsx` `offeringText`: raw `fontSize: 13`/`lineHeight: 19`/raw color → `...TypeScale.body` + `Colors.textTertiary`.

## 3c. Confirmed current state (audit, 2026-08)

The early-out this slice replaces is at `artifacts/mineral/lib/firebase.ts` (`initAppCheck()`, `Platform.OS !== "web"` return). Expo SDK 54 / firebase JS SDK 12 — choose the config-plugin library accordingly. Everything else in §0–§2 remains accurate as written.

## 4. Explicitly out of scope

Enforcement flips of any kind; `enforceAppCheck` on callables; Play Integrity hardening beyond what the library gives freely; any auth, rules, or screen changes.

## 5. Enforce-day checklist (LATER — console actions, not a Replit task)

Run only after several days of ≥99% verified-request metrics from real TestFlight usage, and before any external tester or founding member touches the app:

1. Firebase console → App Check → Firestore → **Enforce**.
2. Same for **Storage**.
3. Add `enforceAppCheck: true` to `deleteAccount` (and any other callables) in `functions/index.js`; deploy. *(This is the one code change; it can be pre-staged.)*
4. Immediately verify on a TestFlight device: capture, playback, delete-account guard path, sign-in — all functional.
5. Rollback path: each toggle flips back off in the console instantly; the callable redeploys without the flag. No data is at risk either way.
