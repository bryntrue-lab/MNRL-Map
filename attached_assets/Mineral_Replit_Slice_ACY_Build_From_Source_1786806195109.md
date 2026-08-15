# Mineral — Slice ACY: build React Native from source (drop the precompiled core)

*Standing instruction applies. This slice changes ONE build property in `app.json` — no code, no dependencies, no other config.*

## 0. What build 5 told us

Build 4 died at ~200ms with a native exception on the TurboModule queue. Build 5 — with the ACX kill switch confirmed in place — got past that entirely and died at ~480ms with a **segmentation fault inside the Hermes JavaScript engine itself** (`EXC_BAD_ACCESS`, wild address `0x100000000`, faulting frames `hermes::vm::getMethod` ← `hermes::vm::stringPrototypeMatch`): the VM crashed while executing a routine `String.prototype.match` call. A healthy JS engine cannot segfault on `.match` — when it does, the engine's memory is corrupt, and the JS line it happens to be executing is incidental.

Two different-looking startup crashes across two builds is the signature of a **poisoned binary**, not an app-code bug. The crash log's loaded-image list shows why: the app shipped React Native's **precompiled core** (`React.framework`, `ReactNativeDependencies.framework`, prebuilt `hermes.framework` as dynamic frameworks) *combined with* `useFrameworks: "static"` — a pairing with known problems in Expo SDK 54 (expo/expo #39233), alongside multiple open reports of prebuilt-Hermes crashes on physical iOS 26 devices (expo/expo #44356, #44606 — the latter describing exactly our pattern: a TurboModule NSException plus downstream Hermes heap corruption).

## ACY1. The one-line change

In `app.json`, the `expo-build-properties` plugin entry becomes:

```json
[
  "expo-build-properties",
  {
    "ios": {
      "useFrameworks": "static",
      "buildReactNativeFromSource": true
    }
  }
]
```

`buildReactNativeFromSource: true` disables both precompiled xcframeworks (`React.xcframework` and `ReactNativeDependencies.xcframework`) and compiles React Native core from source — the boring, well-trodden configuration that Firebase-using React Native apps have shipped on for years. `useFrameworks: "static"` and `./plugins/withRnfbNoSpm.js` stay exactly as they are. The ACX kill switch stays OFF (one variable per build — native App Check returns in a later build once boot is stable).

## ACY2. Rebuild

`npx eas-cli build --platform ios --profile production`, then submit. Expect a noticeably longer build (~2–3×) — precompiled core is a build-speed feature, and we are turning it off.

## Acceptance

- [ ] Fresh TestFlight install (build 6) launches to the Hello screen and survives onboarding, a capture, and sign-in guard.
- [ ] The new build's loaded frameworks no longer include `React.framework` / `ReactNativeDependencies.framework` (verifiable only via a future crash log — the real acceptance is simply that it boots).
- [ ] File list in the checkpoint summary confirms: `app.json` only.

## Out of scope

Re-enabling native App Check (next build after boot is proven); any dependency or code change; any Firebase console change.
