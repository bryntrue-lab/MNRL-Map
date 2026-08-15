# Mineral — Slice ACX: TestFlight startup crash — isolate and disarm

*Standing instruction applies. This slice touches `lib/appCheckNative.ts`, and produces one prebuild verification report — nothing else. No screen code, no data layer, no Firebase console changes.*

## 0. What happened

TestFlight build 4 (v1.0.0) crashes ~200ms after launch on a physical device. The crash log shows an uncaught **native Objective-C exception** thrown inside an asynchronous native-module method on the React Native TurboModule queue (`com.meta.react.turbomodulemanager.queue`): `objc_exception_rethrow` → `ObjCTurboModule::performVoidMethodInvocation` → `abort()`. The main thread and the JS thread were healthy; the log carries no exception reason string.

Key fact: **JS-level `try/catch` cannot contain this.** The exception is thrown on a native dispatch queue after the JS call has already returned — the `try/catch` in `appCheckNative.ts` guards the JS side only. In release builds RN rethrows the native exception and the process aborts.

The only third-party native module the app exercises in its first 200ms is `@react-native-firebase/app-check`, via the boot sequence in `lib/firebase.ts`: `initializeAppCheck` (JS SDK, `isTokenAutoRefreshEnabled: true`) → CustomProvider immediately calls `getNativeAppCheckToken()` → `require("@react-native-firebase/app-check")` → `appCheck()` → `provider.configure(...)` → native `initializeAppCheck` → `getToken(false)`. That is the prime suspect. This slice does not yet fix the root cause — it **disarms the suspect so the app can boot**, and confirms the diagnosis by elimination.

## ACX1. Kill switch: native App Check behind an explicit opt-in flag

In `lib/appCheckNative.ts`, at the very top of `setup()`'s async body — **before the Expo Go check, before any `require` of anything RNFB** — add:

```ts
if (process.env.EXPO_PUBLIC_NATIVE_APPCHECK !== "1") {
  console.log("[app-check] native attestation disabled by flag; skipped.");
  return null;
}
```

Behavior notes, all intentional:

- Default is OFF. No env var needs to be set anywhere for this build — the flag must be explicitly `"1"` to enable. When we re-enable later, it goes into `eas.json`'s production profile `env`, not Replit Secrets (it is not a secret; `EXPO_PUBLIC_*` values are inlined at bundle time).
- With the flag off, **zero RNFB JS or native code executes at runtime** — the module is never required, so the TurboModule is never instantiated. (TurboModules are lazy; presence in the binary is harmless.)
- Everything downstream already handles this correctly by design: `getNativeAppCheckToken` throws a JS error, the JS SDK treats it as "attestation failed," and with enforcement OFF in the Firebase console (it is), every request proceeds unattested — identical to pre-Slice-AC behavior. The app is fully functional.
- Web reCAPTCHA path untouched. Dev/Expo Go behavior untouched (the flag check simply fires first).

## ACX2. Prebuild verification report (report only — fix nothing without asking)

Run `npx expo prebuild --platform ios --clean --no-install` in a scratch copy and report three facts from the generated `ios/` directory:

1. `AppDelegate` contains the RNFB-injected `FirebaseApp.configure()` (or `[FIRApp configure]`) call.
2. `GoogleService-Info.plist` was copied into the iOS project and its `BUNDLE_ID` is `com.madebymineral.quartz`, `GOOGLE_APP_ID` ends `ios:876e34ccc6cf36d5dcbb1d`.
3. The Podfile's first line is `$RNFirebaseDisableSPM = true` (the `withRnfbNoSpm` plugin still applies after `--clean`).

Also report: the installed versions of `@react-native-firebase/app` and `@react-native-firebase/app-check` from the lockfile (they must be identical).

## ACX3. Rebuild

`eas build --platform ios --profile production` (build number auto-increments), then `eas submit` as before.

## Acceptance

- [ ] Fresh TestFlight install (build 5) launches to the Hello screen and survives normal use: onboarding, a capture, sign-in guard path.
- [ ] Device console (if inspectable) or dev-build log shows `[app-check] native attestation disabled by flag; skipped.`
- [ ] ACX2 report delivered with the three facts + versions.
- [ ] File list in the checkpoint summary confirms: `lib/appCheckNative.ts` only (plus no committed scratch prebuild output).

## Out of scope

The root-cause fix for the RNFB app-check exception (comes next, informed by whether build 5 boots and by the ACX2 report); any Firebase console change; enforcement of any kind. Re-enabling native attestation is required before enforce-day (AC §5) — it is deliberately parked, not dropped.
