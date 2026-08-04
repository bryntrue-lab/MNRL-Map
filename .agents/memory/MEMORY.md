# Mineral Memory

- [Firebase v12 React Native auth](firebase-v12-rn.md) — getReactNativePersistence removed in v12; use inMemoryPersistence on native or getAuth on web.
- [Firebase project config](firebase-project-config.md) — anonymous auth now ON (was off → 400 ADMIN_ONLY_OPERATION); provider toggles work via Identity Toolkit Admin API + service account.
- [Profile cache Timestamps](profile-cache-timestamps.md) — JSON-cached profile degrades Timestamps to plain objects; new user-doc Timestamp fields must join TIMESTAMP_FIELDS in UserContext.
- [Firebase deploy limits](firebase-deploy-limits.md) — Blaze+IAM now granted; recipe: fix lockfile, retry first gen2 deploy, delete FAILED shells, Speech SA needs bucket objectViewer.
- [Replit lockfile proxy](replit-lockfile-proxy.md) — package-lock resolved URLs point at package-firewall.replit.local (+/npm/ prefix); rewrite both before any off-Replit build.
- [Web e2e limits](web-e2e-limits.md) — tester has no fake-mic flags; voice = quiet fallback on web; verify pipeline server-side and rules via REST probes.
- [Expo Router routing gotchas](expo-router-routing.md) — /(tabs) replace lands on index not initialRouteName; per-uid profile cache required for entry routing.
- [Exemplar-capped proof](exemplar-capped-proof.md) — never prove a whole-note-set claim from capped exemplars; phrase merges need full coverage gate.
- [Shell quirks](shell-quirks.md) — pkill -f self-match kills your own script (bracket trick); nohup background procs die when the ShellExec call returns.
