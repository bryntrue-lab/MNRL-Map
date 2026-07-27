# Mineral Memory

- [Firebase v12 React Native auth](firebase-v12-rn.md) — getReactNativePersistence removed in v12; use inMemoryPersistence on native or getAuth on web.
- [Firebase project config](firebase-project-config.md) — anonymous auth now ON (was off → 400 ADMIN_ONLY_OPERATION); provider toggles work via Identity Toolkit Admin API + service account.
- [Profile cache Timestamps](profile-cache-timestamps.md) — JSON-cached profile degrades Timestamps to plain objects; new user-doc Timestamp fields must join TIMESTAMP_FIELDS in UserContext.
- [Firebase deploy limits](firebase-deploy-limits.md) — rules deploys work with the SA; functions need Blaze + Editor/SA-User IAM first; use workspace firebase-tools, not npx.
- [Web e2e limits](web-e2e-limits.md) — tester has no fake-mic flags; voice = quiet fallback on web; verify pipeline server-side and rules via REST probes.
- [Shell self-kill](shell-quirks.md) — pkill -f patterns matching your own bash -c cmdline kill your own script; use the bracket trick.
