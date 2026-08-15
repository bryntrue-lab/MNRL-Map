---
name: Native App Check pattern
description: How Mineral does App Attest with the Firebase JS SDK, and the admin-API tricks used to set it up.
---

**Rule:** On native, App Check tokens come from `@react-native-firebase/app-check` used ONLY as a token source, bridged into the Firebase JS SDK via `CustomProvider` (lib/appCheckNative.ts). Never replace the JS SDK data layer with RNFirebase. Expo Go has no native module — the lazy require fails, is caught, and the app runs unattested (fine while enforcement is off).

**Why:** Slice AC ruling: no eject, JS SDK stays the only data SDK; enforcement is a console/API toggle taken later (enforce-day checklist lives in the slice doc).

**Status (2026-08-14):** native attestation is DISARMED by a kill switch — `setup()` returns null unless `EXPO_PUBLIC_NATIVE_APPCHECK === "1"` (set via eas.json production env when re-enabling, never Replit Secrets). Reason: TestFlight build 4 crashed ~200ms post-launch with an uncaught native ObjC exception on the TurboModule queue; JS try/catch cannot contain native-queue throws in release builds. Root-cause fix pending; re-enable is an enforce-day prerequisite.

**iOS build gotchas:** RNFB's SPM mode breaks EAS builds both ways (static: "SPM + static linkage not supported"; dynamic: app target never links FirebaseCore → `_OBJC_CLASS_$_FIRApp` link failure). Fix: static frameworks + `plugins/withRnfbNoSpm.js` prepending `$RNFirebaseDisableSPM = true` to the Podfile. Also: `expo prebuild` side-effects package.json (run scripts + duplicate deps) — revert it and delete ios/ after scratch prebuilds. Expo Go additionally throws *async* ("NativeRNFBTurboApp is not registered") on mere require — guard with expo-constants `executionEnvironment === "storeClient"` before requiring.

**How to apply:**
- Dev builds use the debug provider (`__DEV__`), optional `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN`; native SDK logs the token on first run — founder registers it in console.
- `initAppCheck()` must run immediately after `initializeApp`, before service getters.
- iOS needs `expo-build-properties` `useFrameworks: "static"` + googleServicesFile entries in app.json.
- Firebase project quirks: the ORIGINAL iOS registration was bundle `com.mnrl.resonance`; the shipping app is `com.madebymineral.quartz` (iOS app `1:190347227688:ios:876e34ccc6cf36d5dcbb1d`, created + plist fetched via Firebase Management API with the service account). Android app registered the same way.
- The App Check admin API (`firebaseappcheck.googleapis.com`) was disabled; enable via serviceusage `:enable` with the service account, then PATCH `apps/<appId>/appAttestConfig?updateMask=tokenTtl` registers App Attest. Enforcement state readable at `/v1/projects/<p>/services` (all UNENFORCED as of 2026-08-13).
