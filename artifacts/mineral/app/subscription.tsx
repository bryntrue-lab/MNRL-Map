import { Stack, router, useLocalSearchParams } from "expo-router";
import { onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Linking } from "react-native";

import SubscriptionView, { type OfferState, type SubscriptionState } from "@/components/SubscriptionView";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useMembership } from "@/hooks/useMembership";
import { fieldNotesQuery } from "@/lib/firestore";
import { invitationEvidence, invitationSeenUpdate, type InvitationEvidence } from "@/lib/membership";
import { subscribePatternDocuments, type PatternDocuments } from "@/lib/patternEvidence";
import {
  loadSubscriptionPlans, purchaseSubscription, redeemSubscriptionCode, restoreSubscription,
  refreshSubscriptionAccess, SubscriptionError,
  type SubscriptionPlans, type SubscriptionAccess,
} from "@/lib/subscriptions";

const TERMS = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

type Params = { restore?: string; from?: string; e?: string; t?: string; m?: string };

/**
 * Model B — one invitation for every surface. Opened from the day-eight
 * threshold (from=day8, carrying the already-built encounter's route params)
 * or from any gated depth surface. It never blocks free practice: the
 * invitation and Not Now render even when the offering or legal config is
 * missing; only the purchase controls disable.
 */
export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { profile, updateProfile } = useUser();
  const { active } = useMembership();
  const params = useLocalSearchParams<Params>();
  const fromThreshold = params.from === "day8" && typeof params.e === "string";
  const [state, setState] = useState<SubscriptionState>("plans");
  const [offer, setOffer] = useState<OfferState>("loading");
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [busy, setBusy] = useState(false);
  const [patterns, setPatterns] = useState<PatternDocuments>({});
  const [noteCount, setNoteCount] = useState(0);
  const operation = useRef<number | null>(null);
  const generation = useRef(0);
  const uid = user?.uid;
  const latestUid = useRef(uid);
  latestUid.current = uid;
  const lastAction = useRef<"load" | "restore">("load");
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const privacyAvailable = !!privacyUrl && /^https:\/\//.test(privacyUrl);

  const activeRef = useRef(active);
  activeRef.current = active;
  const hadMembership = useRef(false);
  hadMembership.current = Boolean(profile?.membershipSince || profile?.membershipProductId);

  // ── leaving: day-eight continues into the held encounter; gates go back ──
  // Leaving never waits on a purchase: in-flight results are orphaned (the
  // server sync + profile snapshot still land), and the screen exits now.
  const left = useRef(false);
  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    generation.current++;
    operation.current = null;
    if (fromThreshold) {
      router.replace({
        pathname: "/encounter",
        params: { e: params.e as string, t: params.t ?? "", m: params.m ?? "sequence" },
      });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [fromThreshold, params.e, params.t, params.m]);

  // Android hardware back = Not Now (day eight still enters its encounter).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  // ── seen on display, not on purchase; monotonic ──
  const markedSeen = useRef(false);
  useEffect(() => {
    if (!fromThreshold || markedSeen.current || !profile) return;
    const update = invitationSeenUpdate(profile);
    markedSeen.current = true;
    if (update) updateProfile(update).catch(error => {
      markedSeen.current = false;
      console.warn("[membership] Invitation acknowledgement was not saved", error);
    });
  }, [fromThreshold, profile, updateProfile]);

  // ── personal evidence: only real patterns and notes ──
  useEffect(() => {
    setPatterns({});
    setNoteCount(0);
    if (!uid) return;
    const offP = subscribePatternDocuments(uid, setPatterns, () => setPatterns({}), ["motif", "thread", "resistance"]);
    const offN = onSnapshot(fieldNotesQuery(uid), (s) => setNoteCount(s.size), () => setNoteCount(0));
    return () => { offP(); offN(); };
  }, [uid]);
  const evidence: InvitationEvidence | null = invitationEvidence(patterns, noteCount);

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

  // The controller trusts only the server's `practice` bool.
  const accept = (access: SubscriptionAccess, owner: string) => {
    if (latestUid.current !== owner) return;
    setState(access.practice === true ? "confirmed" : "not-found");
  };

  // Prices load beside the invitation — never in front of it.
  const loadOffer = useCallback(async () => {
    if (!uid) { setOffer("unavailable"); return; }
    lastAction.current = "load";
    setOffer("loading");
    const ticket = generation.current;
    try {
      const available = await loadSubscriptionPlans(uid);
      if (ticket !== generation.current || latestUid.current !== uid) return;
      setPlans(available);
      setOffer("ready");
    } catch {
      if (ticket !== generation.current) return;
      setOffer("unavailable");
    }
  }, [uid]);

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
    if (!uid) { setState("plans"); setOffer("unavailable"); return; }
    if (params.restore === "1") void restoreNow();
    else if (activeRef.current) setState("confirmed");
    else if (hadMembership.current && !fromThreshold) setState("expired");
    else setState("plans");
    void loadOffer();
    return () => { generation.current++; };
  }, [uid]); // Once per identity; profile snapshots don't reset the invitation.

  // Foreground: the server is the only source of truth (covers offer codes,
  // purchases finished outside the app, and Ask to Buy approvals).
  useEffect(() => {
    const listener = AppState.addEventListener("change", next => {
      if (next !== "active" || !uid || operation.current !== null) return;
      void run(async () => {
        const access = await refreshSubscriptionAccess(uid);
        if (access.practice === true) accept(access, uid);
      });
    });
    return () => listener.remove();
  }, [uid, run]);

  const open = async (url: string | undefined) => {
    try {
      if (!url || !/^https:\/\//.test(url)) return; // never fabricate a link
      await Linking.openURL(url);
    } catch { /* the invitation stays; nothing to announce */ }
  };

  const buy = (which: "monthly" | "annual") => {
    if (!uid || !plans || !privacyAvailable) return;
    void run(async () => { accept(await purchaseSubscription(uid, plans[which]), uid); });
  };

  return <>
    {/* Day eight: no iOS swipe-back that would skip the encounter. */}
    <Stack.Screen options={{ gestureEnabled: !fromThreshold }} />
    <SubscriptionView
    state={state} offer={offer} busy={busy} evidence={evidence}
    purchasesEnabled={privacyAvailable}
    privacyAvailable={privacyAvailable}
    annualPrice={plans?.annual.product.priceString}
    monthlyPrice={plans?.monthly.product.priceString}
    onPurchaseMonthly={() => buy("monthly")}
    onPurchaseAnnual={() => buy("annual")}
    onRedeem={() => {
      if (!uid || !privacyAvailable) return;
      void run(async () => {
        const access = await redeemSubscriptionCode(uid);
        if (access.practice === true) accept(access, uid);
      });
    }}
    onRestore={() => void restoreNow()}
    onRetry={() => {
      if (lastAction.current === "restore") void restoreNow();
      else { setState("plans"); void loadOffer(); }
    }}
    onRetryOffer={() => void loadOffer()}
    onDismiss={leave} onContinue={leave}
    onRenew={() => { setState("plans"); void loadOffer(); }}
    onPrivacy={() => void open(privacyUrl)} onTerms={() => void open(TERMS)}
  />
  </>;
}
