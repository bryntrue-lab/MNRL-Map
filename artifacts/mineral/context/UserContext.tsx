import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FieldValue,
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { MembershipStatus, PhaseId, UserDoc } from "@/types/firestore";

// UserProfile is the public alias used throughout the app.
export type UserProfile = UserDoc;

interface UserContextValue {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

const PROFILE_CACHE_KEY = "mineral_user_profile";

// Firestore Timestamps survive a JSON round-trip only as plain
// { seconds, nanoseconds } objects — revive them on cache hydration so
// consumers can rely on real Timestamp instances (`.toDate()` etc).
const TIMESTAMP_FIELDS = [
  "birthDate",
  "journeyStartedAt",
  "createdAt",
  "membershipSince",
  "membershipExpiresAt",
] as const;

function reviveTimestamp(v: unknown): unknown {
  if (
    v &&
    typeof v === "object" &&
    typeof (v as { seconds?: unknown }).seconds === "number" &&
    typeof (v as { nanoseconds?: unknown }).nanoseconds === "number"
  ) {
    const t = v as { seconds: number; nanoseconds: number };
    return new Timestamp(t.seconds, t.nanoseconds);
  }
  return v ?? null;
}

function reviveProfile(raw: Record<string, unknown>): UserProfile {
  const p: Record<string, unknown> = { ...raw };
  for (const f of TIMESTAMP_FIELDS) p[f] = reviveTimestamp(p[f]);
  return p as unknown as UserProfile;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // A new uid (sign-out → fresh anonymous session, account switch) must
    // never route off the previous user's profile: reset to loading and
    // key the local cache per uid so hydration can't cross users.
    setProfile(null);
    setLoading(true);
    const cacheKey = `${PROFILE_CACHE_KEY}_${user.uid}`;
    let live = false;

    // Cache-first: show locally persisted profile instantly on cold start.
    AsyncStorage.getItem(cacheKey).then((cached) => {
      if (cached && !live) {
        try {
          setProfile(reviveProfile(JSON.parse(cached)));
        } catch {}
      }
    });

    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      live = true;
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        // First sign-in — create the user doc with all required defaults.
        // Security rules require the five server-controlled fields to be at
        // their initial values on create (membershipStatus='free', counts=0,
        // timestamps=null). serverTimestamp() is used for Firestore-side accuracy.
        const newDoc: Omit<UserDoc, "journeyStartedAt" | "createdAt"> & {
          journeyStartedAt: FieldValue;
          createdAt: FieldValue;
        } = {
          email: user.email ?? "",
          birthDate: null,
          birthTime: null,
          birthLocation: null,
          humanDesignType: null,
          currentPhase: "signal" as PhaseId,
          currentTurn: 1,
          sequenceDay: 1,
          journeyStartedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          membershipStatus: "free" as MembershipStatus,
          membershipSince: null,
          membershipExpiresAt: null,
          membershipProductId: null,
          completedEncounterCount: 0,
        };
        setDoc(ref, newDoc).catch(() => {});
        // Optimistic local state while the write resolves.
        setProfile(newDoc as unknown as UserProfile);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, updates, { merge: true });
    },
    [user]
  );

  return (
    <UserContext.Provider value={{ profile, loading, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
