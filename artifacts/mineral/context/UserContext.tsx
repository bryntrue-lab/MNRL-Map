import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { Phase } from "@/constants/theme";

export interface UserProfile {
  email: string;
  birthDate?: string;
  birthTime?: string;
  birthLocation?: string;
  createdAt: number;
  currentDay: number;
  currentPhase: Phase;
}

interface UserContextValue {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

const PROFILE_CACHE_KEY = "mineral_user_profile";

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

    // Load from cache first for instant display
    AsyncStorage.getItem(PROFILE_CACHE_KEY).then((cached) => {
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
        } catch {}
      }
    });

    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
      } else {
        // Create default profile for new user
        const newProfile: UserProfile = {
          email: user.email ?? "",
          createdAt: Date.now(),
          currentDay: 1,
          currentPhase: "signal",
        };
        setDoc(ref, newProfile).catch(() => {});
        setProfile(newProfile);
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
