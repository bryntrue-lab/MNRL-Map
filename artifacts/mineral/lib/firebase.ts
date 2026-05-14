import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
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

function getFirebaseAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  try {
    const { getReactNativePersistence } = require("firebase/auth");
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

let _auth: Auth | null = null;
export function getFirebaseAuthSingleton(): Auth {
  if (!_auth) {
    _auth = getFirebaseAuth();
  }
  return _auth;
}

export const auth = getFirebaseAuthSingleton();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
