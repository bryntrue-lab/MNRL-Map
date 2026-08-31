# Mineral Memory

- [Firebase v12 React Native auth](firebase-v12-rn.md) — getReactNativePersistence removed in v12; use inMemoryPersistence on native or getAuth on web.
- [Firebase project config](firebase-project-config.md) — anonymous auth now ON (was off → 400 ADMIN_ONLY_OPERATION); provider toggles work via Identity Toolkit Admin API + service account.
- [Profile cache Timestamps](profile-cache-timestamps.md) — JSON-cached profile degrades Timestamps to plain objects; new user-doc Timestamp fields must join TIMESTAMP_FIELDS in UserContext.
- [Firebase deploy limits](firebase-deploy-limits.md) — Blaze+IAM granted; gen2 deploy recipe; also: mint founder idToken via custom token to invoke callables (e.g. rebuild).
- [Replit lockfile proxy](replit-lockfile-proxy.md) — package-lock resolved URLs point at package-firewall.replit.local (+/npm/ prefix); rewrite both before any off-Replit build.
- [Web e2e limits](web-e2e-limits.md) — tester has no fake-mic flags; voice = quiet fallback on web; verify pipeline server-side and rules via REST probes.
- [Expo Router routing gotchas](expo-router-routing.md) — /(tabs) replace lands on index not initialRouteName; per-uid profile cache required for entry routing.
- [Exemplar-capped proof](exemplar-capped-proof.md) — never prove a whole-note-set claim from capped exemplars; phrase merges need full coverage gate.
- [Expo Go dev storage + notifications](expo-go-dev-storage.md) — per-experience AsyncStorage wipes each dev session; compute-then-swap rescheduling; coords never leave device.
- [practitionerContent rules gate](practitioner-content-rules.md) — new content kinds need a rules whitelist + deploy; client fallbacks hide permission-denied reads; blank screens can be unrenderable block *types*.
- [Firestore RN transport](firestore-rn-transport.md) — web SDK streaming hangs minutes on native; force experimentalForceLongPolling on non-web.
- [Copy canon rules](copy-canon.md) — never invent user-facing strings; unspecified copy → ask founder first; never name tabs/navigation in ritual copy.
- [Native App Check](app-check-native.md) — RNFirebase app-check as token source only, CustomProvider into JS SDK; App Check admin API enable + appAttestConfig via service account; quartz iOS app id noted.
- [Shell quirks](shell-quirks.md) — pkill -f self-match kills your own script (bracket trick); nohup background procs die when the ShellExec call returns.
- [Firebase function parameters](firebase-function-parameters.md) — noninteractive deploys need defineString values in a project dotenv; shell exports are ignored.
