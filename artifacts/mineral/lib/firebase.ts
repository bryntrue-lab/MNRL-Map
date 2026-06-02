import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, inMemoryPersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

function initAuth(): Auth {
  if (Platform.OS === "web") {
    // Web: Firebase uses IndexedDB persistence by default.
    return getAuth(app);
  }

  // Native: Firebase v12 removed getReactNativePersistence from firebase/auth.
  // Use inMemoryPersistence (users re-authenticate on app restart; persistent
  // sessions can be added once Firebase restores the React Native API).
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    // Auth already initialized — happens on hot reload.
    return getAuth(app);
  }
}

export const auth = initAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
