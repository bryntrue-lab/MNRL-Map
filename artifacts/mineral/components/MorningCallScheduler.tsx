/**
 * Slice 6 §4 — the 30-day queue is rebuilt on every foreground/background
 * transition from the CURRENT pointer, and a notification tap opens the
 * Origin tab. Renders nothing; mounted once inside UserProvider.
 */
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useUser } from "@/context/UserContext";
import { rescheduleMorningCall } from "@/lib/notifications";

export default function MorningCallScheduler() {
  const { profile } = useUser();
  const pointerRef = useRef({ day: 1, turn: 1 });
  pointerRef.current = {
    day: profile?.sequenceDay ?? 1,
    turn: profile?.currentTurn ?? 1,
  };

  useEffect(() => {
    if (Platform.OS === "web") return;

    const reschedule = () => {
      const { day, turn } = pointerRef.current;
      rescheduleMorningCall(day, turn).catch(() => {});
    };

    reschedule(); // cold start counts as a transition

    const sub = AppState.addEventListener("change", () => {
      // §4: every foreground/background transition.
      reschedule();
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
