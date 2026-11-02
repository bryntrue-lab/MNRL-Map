import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { refreshSubscriptionAccess } from "@/lib/subscriptions";

// Reconcile on sign-in and foreground, not only after an in-app purchase.
// Failure leaves the last verified expiry untouched; access does not depend
// on a successful network request on every foreground transition.
export default function SubscriptionSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let last = 0;
    const sync = () => {
      if (Date.now() - last < 30000) return;
      last = Date.now();
      void refreshSubscriptionAccess(user.uid).catch(() => {});
    };
    sync();
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") sync();
    });
    return () => listener.remove();
  }, [user?.uid]);
  return null;
}
