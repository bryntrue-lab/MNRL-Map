---
name: Firebase v12 React Native auth persistence
description: getReactNativePersistence DOES exist in firebase v12's RN bundle — earlier "removed in v12" note was a misdiagnosis from testing with Node's resolver.
---

# Firebase v12 + React Native auth persistence

**Rule:** In this stack (firebase 12.x, Expo/Metro), use
`initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`
on native (with `// @ts-ignore` on the import) and `browserLocalPersistence` on web.
Never fall back to `inMemoryPersistence` — it logs the user out on every cold
start, fatal for a daily-return practice app.

**Why:** An earlier session concluded `getReactNativePersistence` was removed in
firebase v12 because `require('firebase/auth')` in Node returns the node/browser
build, where the symbol is absent. That was a misdiagnosis. `@firebase/auth`
(1.13.x) ships a `react-native` condition in its package exports →
`dist/rn/index.js`, which DOES export `getReactNativePersistence`. Metro (Expo
SDK 54, package exports enabled) resolves the nested `@firebase/auth` import
with the `react-native` condition, so the symbol exists at runtime in the native
bundle. Only the TypeScript types (and node/browser builds) lack it — hence the
`@ts-ignore`, not a runtime fallback.

**How to apply:** Don't "verify" this symbol with `node -e require(...)` — Node
never sees the RN build. Check `@firebase/auth`'s package.json `exports` for the
`react-native` condition and grep `dist/rn/index.js` instead. The web bundle
never calls the RN branch, so the unused named import is harmless there.
