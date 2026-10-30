import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import SubscriptionView from "@/components/SubscriptionView";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  loadSubscriptionPlans, purchaseSubscription, restoreSubscription,
  refreshSubscriptionAccess, SubscriptionError,
  type SubscriptionPlans, type SubscriptionAccess,
} from "@/lib/subscriptions";

type State = "loading" | "plans" | "confirmed" | "pending" | "not-found" | "unavailable" | "expired";
const TERMS = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { profile } = useUser();
  const { restore } = useLocalSearchParams<{ restore?: string }>();
  const [state, setState] = useState<State>("loading");
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");
  const [busy, setBusy] = useState(false);
  const operation = useRef<number | null>(null);
  const generation = useRef(0);
  const uid = user?.uid;
  const latestUid = useRef(uid);
  latestUid.current = uid;
  const lastAction = useRef<"load" | "restore">("load");
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const initialExpired = useRef(false);
  const initiallyActive = useRef(false);
  initiallyActive.current = profile?.membershipStatus === "member" &&
    (profile.membershipExpiresAt?.toMillis?.() ?? 0) > Date.now();
  initialExpired.current = Boolean(profile?.membershipSince ||
    profile?.membershipProductId || profile?.membershipStatus === "member");

  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const run = useCallback(async (action: () => Promise<void>) => {
    if (operation.current !== null || !uid) return;
    const ticket = generation.current;
    operation.current = ticket;
    setBusy(true);
    try { await action(); }
    catch (error) {
      if (ticket !== generation.current || latestUid.current !== uid) return;
      if ((error as { userCancelled?: boolean }).userCancelled) setState("plans");
      else if (error instanceof SubscriptionError && error.code === "pending") setState("pending");
      else setState("unavailable");
    } finally {
      if (operation.current === ticket) operation.current = null;
      if (ticket === generation.current) setBusy(false);
    }
  }, [uid]);

  const accept = (access: SubscriptionAccess, owner: string) => {
    if (latestUid.current !== owner) return;
    setState(access.membershipStatus === "member" ? "confirmed" : "not-found");
  };

  const load = useCallback(async () => {
    if (!uid) return;
    lastAction.current = "load";
    await run(async () => {
      setState("loading");
      if (!privacyUrl || !/^https:\/\//.test(privacyUrl)) throw new SubscriptionError("unavailable");
      const available = await loadSubscriptionPlans(uid);
      if (latestUid.current !== uid) return;
      setPlans(available);
      setState("plans");
    });
  }, [uid, run, privacyUrl]);

  const restoreNow = useCallback(async () => {
    if (!uid) return;
    lastAction.current = "restore";
    await run(async () => { accept(await restoreSubscription(uid), uid); });
  }, [uid, run]);

  useEffect(() => {
    generation.current++;
    operation.current = null;
    setBusy(false);
    setPlans(null);
    if (!uid) { setState("unavailable"); return; }
    if (restore === "1") void restoreNow();
    else if (initiallyActive.current) setState("confirmed");
    else if (initialExpired.current) setState("expired");
    else void load();
    return () => { generation.current++; };
  }, [uid]); // Only start once per identity; profile snapshots don't reset the paywall.

  useEffect(() => {
    const listener = AppState.addEventListener("change", next => {
      if (next !== "active" || !uid || operation.current !== null) return;
      void run(async () => {
        const access = await refreshSubscriptionAccess(uid);
        if (access.membershipStatus === "member") accept(access, uid);
      });
    });
    return () => listener.remove();
  }, [uid, run]);

  const open = async (url: string | undefined) => {
    try {
      if (!url || !/^https:\/\//.test(url)) throw new Error("Missing legal URL");
      await Linking.openURL(url);
    } catch { setState("unavailable"); }
  };

  return <SubscriptionView
    state={state} selected={selected} busy={busy}
    annualPrice={plans?.annual.product.priceString}
    monthlyPrice={plans?.monthly.product.priceString}
    onSelect={setSelected}
    onPurchase={() => {
      if (!uid || !plans) return;
      void run(async () => { accept(await purchaseSubscription(uid, plans[selected]), uid); });
    }}
    onRestore={() => void restoreNow()}
    onRetry={() => void (lastAction.current === "restore" ? restoreNow() : load())}
    onDismiss={dismiss} onContinue={dismiss}
    onRenew={() => void load()}
    onPrivacy={() => void open(privacyUrl)} onTerms={() => void open(TERMS)}
  />;
}
