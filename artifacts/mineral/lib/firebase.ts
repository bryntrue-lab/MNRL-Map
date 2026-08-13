import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  // @ts-ignore — getReactNativePersistence exists at runtime in the RN bundle
  // but is missing from some firebase@12 type definitions. §9.
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "mineral-resonance.firebaseapp.com",
  projectId: "mineral-resonance",
  storageBucket: "mineral-resonance.firebasestorage.app",
  messagingSenderId: "190347227688",
  appId: "1:190347227688:web:a7d8dae3f5c6c74bdcbb1d",
  measurementId: "G-FDKRRRZ2GK",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Slice AC — App Check initializes immediately after initializeApp, before
// any service getter below runs, so the first Firestore/Storage/Functions
// call already carries attestation. (Function declaration is hoisted.)
initAppCheck();

// §9 — Restore AsyncStorage persistence so sessions survive cold start on native.
// The previous inMemoryPersistence caused a log-out on every cold start — fatal
// for a daily-return practice. getReactNativePersistence is present at runtime;
// we suppress the TS error above.
function initAuth(): Auth {
  try {
    if (Platform.OS === "web") {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    }
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized — happens on hot reload.
    return getAuth(app);
  }
}

// §3a / Slice AC — App Check: wired here, enforcement disabled in the
// Firebase console until ≥99% of legitimate requests are attesting
// successfully. Flip the enforcement toggle in the console — no code change.
//
// Web: reCAPTCHA v3 (free, sufficient for v1) — unchanged.
// Native: App Attest (iOS; DeviceCheck fallback automatic) / Play Integrity
// (Android) via @react-native-firebase/app-check as a pure token source,
// bridged into the JS SDK through a CustomProvider (lib/appCheckNative.ts).
// Dev/simulator builds run the debug provider; Expo Go (no native module)
// skips attestation entirely and the app functions as before.
function initAppCheck(): void {
  if (Platform.OS !== "web") {
    // Lazy import keeps web bundles free of the native bridge module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNativeAppCheckToken } = require("./appCheckNative") as
      typeof import("./appCheckNative");
    initializeAppCheck(app, {
      provider: new CustomProvider({ getToken: getNativeAppCheckToken }),
      isTokenAutoRefreshEnabled: true,
    });
    return;
  }

  const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return;

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = initAuth();

// Firestore transport: on native, the web SDK's default WebChannel streaming
// can silently hang on the RN network stack — content appears only after
// multi-minute internal retries (seen as notes/guide blank for 2–3 min on
// open). Force long polling on native; web keeps the default streaming.
function initDb() {
  try {
    if (Platform.OS === "web") return getFirestore(app);
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    // Already initialized — happens on hot reload.
    return getFirestore(app);
  }
}
export const db = initDb();
export const storage = getStorage(app);
// C §3 — the deleteAccount callable lives in us-central1 with the rest.
export const functions = getFunctions(app, "us-central1");

export default app;
