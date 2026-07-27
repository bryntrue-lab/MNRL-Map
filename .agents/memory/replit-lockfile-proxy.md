---
name: Replit npm lockfile proxy URLs break external builds
description: package-lock.json resolved URLs point at Replit's package firewall; any off-Replit builder (Cloud Build/GCF, CI) fails. How to detect and fix.
---

**Rule:** npm lockfiles generated inside this workspace record `"resolved": "http://package-firewall.replit.local/npm/<pkg>/-/<tarball>"` for every package. Any builder outside Replit (Cloud Functions/Cloud Build, GitHub Actions, Vercel…) cannot reach that host — `npm ci` stalls ~70s then dies with the useless generic crash **"npm error Exit handler never called!"**.

**Why:** Hit 2026-07-27 deploying Cloud Functions; both builds failed with that message and no package named. `grep '"resolved"' package-lock.json` showed all 318 URLs on the proxy host.

**How to apply:** Before shipping a lockfile to an external builder:
1. `sed -i 's|http://package-firewall\.replit\.local|https://registry.npmjs.org|g' package-lock.json`
2. `sed -i 's|https://registry\.npmjs\.org/npm/|https://registry.npmjs.org/|g' package-lock.json` (the proxy prefixes paths with `/npm/` — must be stripped too)
3. Integrity hashes stay valid — same tarballs, so no regeneration needed.

Do NOT try to regenerate the lock instead: `npm install --package-lock-only` rebuilds the proxy URLs from node_modules metadata and the workspace registry config, even with `--registry` and `--userconfig /dev/null`.
