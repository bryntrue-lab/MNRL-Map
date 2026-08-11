/**
 * Slice 6 §4 — the 30-day queue is rebuilt on every foreground/background
 * transition from the CURRENT pointer, and a notification tap opens the
 * Origin tab. Renders nothing; mounted once inside UserProvider.
 */
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useUser } from "@/context/UserContext";
import {
  rescheduleMorningCall,
  restoreMorningCallFromProfile,
} from "@/lib/notifications";

export default function MorningCallScheduler() {
  const { profile, loading } = useUser();
  const pointerRef = useRef({ day: 1, turn: 1 });
  pointerRef.current = {
    day: profile?.sequenceDay ?? 1,
    turn: profile?.currentTurn ?? 1,
  };

  const reschedule = () => {
    const { day, turn } = pointerRef.current;
    rescheduleMorningCall(day, turn).catch(() => {});
  };
  const rescheduleRef = useRef(reschedule);
  rescheduleRef.current = reschedule;

  // Restore the mirrored choice from the user doc once per sign-in — a
  // fresh install (or a wiped dev sandbox) must never re-prompt or lose
  // the chosen time. Coordinates are re-fetched locally, never mirrored.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!profile) {
      restoredRef.current = false; // sign-out → next profile restores again
      return;
    }
    // Wait for the LIVE Firestore snapshot — the cache-hydrated profile may
    // predate the mirror and would consume the once-per-sign-in latch.
    if (loading || restoredRef.current) return;
    restoredRef.current = true;
    restoreMorningCallFromProfile(profile)
      .then((changed) => {
        if (changed) rescheduleRef.current();
      })
      .catch(() => {});
  }, [profile, loading]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    rescheduleRef.current(); // cold start counts as a transition

    let appState = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      // §4 (revised): rebuild on transitions TO active only — rebuilding on
      // backgrounding risks iOS suspending JS between the cancel and the
      // reschedule, stranding an empty queue.
      const prev = appState;
      appState = next;
      if (next === "active" && prev !== "active") rescheduleRef.current();
    });

    let tapSub: { remove: () => void } | null = null;
    (async () => {
      const Notifications = await import("expo-notifications");
      // §2: tap opens the app on the Origin tab — including a cold-start
      // tap from a terminated app.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last?.notification.request.content.data?.url === "/(tabs)/origin") {
        router.replace("/(tabs)/origin");
      }
      tapSub = Notifications.addNotificationResponseReceivedListener(() => {
        router.replace("/(tabs)/origin");
      });
    })().catch(() => {});

    return () => {
      sub.remove();
      tapSub?.remove();
    };
  }, []);

  return null;
}
