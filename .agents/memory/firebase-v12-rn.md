---
name: Firebase v12 React Native auth
description: Firebase v12 removed getReactNativePersistence from firebase/auth; how to init auth on native without crashing.
---

## Rule
Do NOT use `getReactNativePersistence` from `firebase/auth` — it is undefined in Firebase v12. The `firebase/auth/react-native` submodule also does not exist in v12. Calling `getAuth(app)` on native (new arch) with default persistence crashes because it tries browser storage APIs (IndexedDB/localStorage).

## Correct pattern (lib/firebase.ts)
```ts
import { Auth, getAuth, inMemoryPersistence, initializeAuth } from "firebase/auth";
import { Platform } from "react-native";

function initAuth(): Auth {
  if (Platform.OS === "web") return getAuth(app);
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);  // hot reload: already initialized
  }
}
export const auth = initAuth();
```

**Why:** Firebase v12 removed the React Native persistence helper. inMemoryPersistence is the safe fallback — users re-authenticate on app restart. The catch handles hot-reload re-initialization.

**How to apply:** Any time firebase.ts is written or modified for this project, use this pattern. Do not import or use `getReactNativePersistence`.
