import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useUser } from "@/context/UserContext";
import { msUntilLapse, practiceActive } from "@/lib/membership";

/**
 * Live membership: profile.practice === true AND membershipExpiresAt in the
 * future. A timer re-evaluates at the exact expiry so depth closes without a
 * restart; foregrounding re-evaluates too.
 */
export function useMembership(): { active: boolean; ready: boolean } {
  const { profile, loading } = useUser();
  const [now, setNow] = useState(() => Date.now());

  const delay = msUntilLapse(profile, now);
  useEffect(() => {
    if (delay == null) return;
    const t = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  // Profile snapshots update `profile`; re-read the clock alongside them.
  useEffect(() => {
    setNow(Date.now());
  }, [profile]);

  return { active: practiceActive(profile, now), ready: !loading && !!profile };
}
