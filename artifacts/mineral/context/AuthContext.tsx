import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { auth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** §4 — first-launch anonymous session. linkWithCredential upgrade is Milestone B. */
  signInAnon: () => Promise<void>;
  logOut: () => Promise<void>;
  /** C §2 — "keep this.": upgrade the anonymous session in place.
   *  linkWithCredential preserves the uid, so every prior note stays. */
  linkWithEmail: (email: string, password: string) => Promise<void>;
  /** C.1 §1h — "send a reset link". */
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signInAnon = useCallback(async () => {
    await signInAnonymously(auth);
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const linkWithEmail = useCallback(async (email: string, password: string) => {
    const current = auth.currentUser;
    if (!current) throw new Error("no session to keep");
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(current, credential);
    // Refresh the context user so isAnonymous/email update immediately.
    setUser(result.user);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signInAnon, logOut, linkWithEmail, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
