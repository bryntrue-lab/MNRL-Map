import React, { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkPrimary, LinkSecondary } from "@/components/Links";
import colors from "@/constants/colors";
import { SubscriptionCopy as C } from "@/constants/subscriptionCopy";
import { TypeScale } from "@/constants/typography";
import { displayItem, spellNumber } from "@/lib/patternText";
import type { InvitationEvidence } from "@/lib/membership";

export type SubscriptionState = "loading" | "plans" | "confirmed" | "pending" | "not-found" | "unavailable" | "expired";
/** Whether localized store prices could be fetched for the invitation. */
export type OfferState = "loading" | "ready" | "unavailable";

export interface SubscriptionViewProps {
  state: SubscriptionState;
  offer: OfferState;
  annualPrice?: string;
  monthlyPrice?: string;
  /** False when the privacy URL is missing — purchases disable, nothing is fabricated. */
  purchasesEnabled: boolean;
  privacyAvailable: boolean;
  evidence: InvitationEvidence | null;
  busy: boolean;
  onPurchaseMonthly: () => void;
  onPurchaseAnnual: () => void;
  onRedeem: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onRetryOffer: () => void;
  onDismiss: () => void;
  onContinue: () => void;
  onRenew: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}

const ROSE = "rgb(224,138,175)";

function Primary({ label, onPress, busy, testID }: { label: string; onPress: () => void; busy: boolean; testID: string }) {
  if (busy) {
    return (
      <View style={styles.primary} accessibilityRole="progressbar" accessibilityState={{ busy: true }} testID={`${testID}-busy`}>
        <ActivityIndicator size="small" color={ROSE} />
      </View>
    );
  }
  return (
    <LinkPrimary label={label} onPress={onPress} disabled={busy} noArrow style={styles.primary}
      textStyle={styles.asWritten} testID={testID} />
  );
}

function Secondary({ label, onPress, busy, testID }: { label: string; onPress: () => void; busy: boolean; testID: string }) {
  return (
    <LinkSecondary label={label} onPress={onPress} disabled={busy} testID={testID}
      style={[styles.secondary, busy && { opacity: 0.4 }]} textStyle={styles.asWritten} />
  );
}

type Plan = "annual" | "monthly";
const PAY = {
  ink: "#FFFFFF", body: "rgba(255,255,255,0.72)", quiet: "rgba(255,255,255,0.58)", meta: "rgba(255,255,255,0.50)",
  hair: "rgba(255,255,255,0.07)", rail: "#E08AAF", cta: "#C4488A", ctaPressed: "#D0579A", ground: "#060309",
} as const;
const SERIF = "CormorantGaramond_500Medium_Italic";
const SANS = "Inter_400Regular";
const SANS_MED = "Inter_500Medium";
const SANS_SEMI = "Inter_600SemiBold";

/** Only render evidence supported by the stored notes and pattern counts. */
function evidenceMeta(e: InvitationEvidence): string {
  const I = C.invitation;
  const base = I.returned(spellNumber(e.count));
  // Notes do not record the practice-day number at capture. Do not infer
  // historical days from capped exemplars, dates, or the current day pointer.
  return base;
}

function PaywallGround() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="g" cx="50%" cy="0%" rx="120%" ry="60%" fx="50%" fy="0%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor="#22132A" />
            <Stop offset="0.55" stopColor="#0C0712" />
            <Stop offset="1" stopColor="#060309" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}

function Invitation(p: SubscriptionViewProps) {
  const I = C.invitation;
  const insets = useSafeAreaInsets();
  const web = Platform.OS === "web";
  const top = web ? 67 : insets.top;
  const bottom = web ? 34 : insets.bottom;
  const [plan, setPlan] = useState<Plan>("annual");
  const [footerH, setFooterH] = useState(0);
  const canBuy = p.offer === "ready" && p.purchasesEnabled && !p.busy && !!p.monthlyPrice && !!p.annualPrice;
  const price = plan === "annual" ? p.annualPrice : p.monthlyPrice;
  const disclosure = p.offer === "ready" && price
    ? (plan === "annual" ? I.annualDisclosure(price) : I.monthlyDisclosure(price))
    : p.offer === "unavailable" ? C.unavailable.body : " ";
  const purchase = plan === "annual" ? p.onPurchaseAnnual : p.onPurchaseMonthly;

  const planRow = (key: Plan, label: string, price: string) => {
    const sel = plan === key;
    return (
      <Pressable key={key} onPress={() => setPlan(key)} disabled={p.busy} accessibilityRole="radio"
        accessibilityState={{ selected: sel, checked: sel, disabled: p.busy }} testID={`subscription-plan-${key}`}
        style={[pw.plan, sel ? pw.planSel : pw.planUnsel]}>
        <View style={[pw.radio, { borderColor: sel ? PAY.rail : "rgba(255,255,255,0.30)" }]}>
          {sel ? <View style={pw.dot} /> : null}
        </View>
        <Text style={pw.label}>{label}</Text>
        <Text style={[pw.label, { flex: 0, flexShrink: 1, textAlign: "right" }]}>{price}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: Math.max(top, 44), paddingHorizontal: 26, paddingBottom: Math.max(196, footerH + 16) }}>
        <View style={pw.column}>
          <View style={pw.header}>
            <Text style={pw.eyebrow}>{I.eyebrow}</Text>
            <Pressable onPress={p.onDismiss} accessibilityRole="button" accessibilityLabel={I.notNow}
              testID="subscription-dismiss" style={({ pressed }) => [pw.notNowHit, { opacity: pressed ? 0.5 : 1 }]}>
              <Text style={pw.notNow}>{I.notNow}</Text>
            </Pressable>
          </View>

          <Text style={pw.headline} accessibilityRole="header">{I.title}</Text>

          {p.evidence ? (
            <View style={pw.exemplar} testID="invitation-evidence">
              <Text style={pw.word}>{displayItem(p.evidence.item)}</Text>
              <Text style={[pw.meta, { marginTop: 5 }]}>{evidenceMeta(p.evidence)}</Text>
            </View>
          ) : null}

          <Text style={[pw.body, { marginTop: 56, color: PAY.body }]}>{I.bodyLead}</Text>
          <Text style={[pw.body, { marginTop: 16, color: PAY.quiet }]}>{I.body}</Text>

          <Text style={[pw.eyebrow, { marginTop: 56 }]}>{I.opensEyebrow}</Text>
          <View style={{ marginTop: 14 }}>
            {I.rows.map((r, i) => (
              <View key={r.name} style={[pw.row, i === I.rows.length - 1 && pw.rowLast]}>
                <Text style={pw.label}>{r.name}</Text>
                <Text style={[pw.meta, { flexShrink: 1, textAlign: "right" }]}>{r.detail}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 48 }} />

          {p.offer === "loading" ? (
            <View style={{ gap: 10 }} testID="subscription-offer-loading">
              <View style={[pw.plan, pw.planUnsel]} />
              <View style={[pw.plan, pw.planUnsel]} />
            </View>
          ) : p.offer === "ready" && p.annualPrice && p.monthlyPrice ? (
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {planRow("annual", I.annualLabel, I.annualPlan(p.annualPrice))}
              {planRow("monthly", I.monthlyLabel, I.monthlyPlan(p.monthlyPrice))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={pw.footer}>
        <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill}
          colors={[PAY.ground, PAY.ground, "rgba(6,3,9,0)"]} locations={[0, 0.72, 1]}
          start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} />
        <View style={[pw.column, { paddingBottom: bottom + 18 }]}>
          {p.offer === "unavailable" ? (
            <Pressable onPress={p.onRetryOffer} accessibilityRole="button" testID="subscription-retry"
              style={({ pressed }) => [pw.cta, { backgroundColor: pressed ? PAY.ctaPressed : PAY.cta }]}>
              <Text style={pw.ctaText}>{C.unavailable.action}</Text>
            </Pressable>
          ) : p.busy ? (
            <View style={[pw.cta, { backgroundColor: PAY.cta }]} accessibilityRole="progressbar"
              accessibilityState={{ busy: true }} testID="subscription-purchase-busy">
              <ActivityIndicator size="small" color={PAY.ink} />
            </View>
          ) : (
            <Pressable onPress={purchase} disabled={!canBuy} accessibilityRole="button"
              accessibilityState={{ disabled: !canBuy }} testID={`subscription-purchase-${plan}`}
              style={({ pressed }) => [pw.cta, { backgroundColor: pressed ? PAY.ctaPressed : PAY.cta, opacity: canBuy ? 1 : 0.45 }]}>
              <Text style={pw.ctaText}>{I.cta}</Text>
            </Pressable>
          )}
          <Text style={[pw.meta, { marginTop: 10, textAlign: "center" }]} testID="subscription-disclosure">{disclosure}</Text>
          <View style={pw.links}>
            <PayLink label={I.restore} onPress={p.onRestore} disabled={p.busy} testID="subscription-restore" />
            <PayLink label={I.redeem} onPress={p.onRedeem} disabled={p.busy || !p.purchasesEnabled} testID="subscription-redeem" />
            <PayLink label={I.terms} onPress={p.onTerms} testID="subscription-terms" />
            <PayLink label={I.privacy} onPress={p.onPrivacy} disabled={!p.privacyAvailable} testID="subscription-privacy" />
          </View>
        </View>
      </View>
    </View>
  );
}

function PayLink({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" testID={testID}
      style={({ pressed }) => [pw.link, { opacity: disabled ? 0.35 : pressed ? 0.5 : 1 }]}>
      <Text style={pw.meta}>{label}</Text>
    </Pressable>
  );
}

const pw = StyleSheet.create({
  column: { width: "100%", maxWidth: 480, alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: SANS_SEMI, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", color: PAY.meta },
  notNowHit: { paddingTop: 14, paddingBottom: 14, paddingLeft: 20, minHeight: 44, justifyContent: "center" },
  notNow: { fontFamily: SANS, fontSize: 12, letterSpacing: 0.1, color: PAY.quiet },
  headline: { fontFamily: SERIF, fontSize: 26, lineHeight: 32, letterSpacing: 0.3, color: PAY.ink, marginTop: 56 },
  exemplar: { marginTop: 40, borderLeftWidth: 1, borderLeftColor: PAY.rail, paddingLeft: 14 },
  word: { fontFamily: SERIF, fontSize: 18, lineHeight: 24, letterSpacing: 0.3, color: PAY.ink },
  meta: { fontFamily: SANS, fontSize: 11, letterSpacing: 0.1, color: PAY.meta },
  body: { fontFamily: SANS, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: SANS, fontSize: 14, color: PAY.ink, flex: 1 },
  row: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12,
    paddingVertical: 18, borderTopWidth: 1, borderTopColor: PAY.hair,
  },
  rowLast: { borderBottomWidth: 1, borderBottomColor: PAY.hair },
  plan: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, minHeight: 52 },
  planSel: { borderColor: "rgba(224,138,175,0.55)", backgroundColor: "rgba(224,138,175,0.07)" },
  planUnsel: { borderColor: "rgba(255,255,255,0.10)", backgroundColor: "transparent" },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAY.rail },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 26 },
  cta: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", minHeight: 52 },
  ctaText: { fontFamily: SANS_MED, fontSize: 15, color: PAY.ink },
  links: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4 },
  link: { paddingVertical: 12, paddingHorizontal: 8, minHeight: 44, justifyContent: "center" },
});

export default function SubscriptionView(p: SubscriptionViewProps) {
  const insets = useSafeAreaInsets();
  const { busy } = p;

  let body: React.ReactNode;
  switch (p.state) {
    case "loading":
      body = <View style={styles.center}><ActivityIndicator color={ROSE} accessibilityLabel="" /></View>;
      break;
    case "plans":
      body = <Invitation {...p} />;
      break;
    case "confirmed":
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{C.confirmed.title}</Text>
          <Text style={styles.body}>{C.confirmed.body}</Text>
          <Primary label={C.confirmed.action} onPress={p.onContinue} busy={false} testID="subscription-continue" />
        </>
      );
      break;
    case "pending":
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{C.pending.title}</Text>
          <Text style={styles.body}>{C.pending.body}</Text>
          <Text style={styles.hint}>{C.pending.hint}</Text>
          <Secondary label={C.pending.action} onPress={p.onRestore} busy={busy} testID="subscription-restore" />
          <Secondary label={C.plans.notNow} onPress={p.onDismiss} busy={false} testID="subscription-dismiss" />
        </>
      );
      break;
    case "not-found":
    case "unavailable": {
      const c = p.state === "not-found" ? C.notFound : C.unavailable;
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
          <Text style={styles.body}>{c.body}</Text>
          {"hint" in c ? <Text style={styles.hint}>{c.hint}</Text> : null}
          <Primary label={c.action} onPress={p.onRetry} busy={busy} testID="subscription-retry" />
          <Secondary label={c.dismiss} onPress={p.onDismiss} busy={false} testID="subscription-dismiss" />
        </>
      );
      break;
    }
    case "expired":
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{C.expired.title}</Text>
          <Text style={styles.body}>{C.expired.body}</Text>
          <Primary label={C.expired.action} onPress={p.onRenew} busy={busy} testID="subscription-renew" />
          <Secondary label={C.expired.dismiss} onPress={p.onDismiss} busy={false} testID="subscription-dismiss" />
        </>
      );
      break;
  }

  if (p.state === "plans") {
    return (
      <View style={[styles.container, { backgroundColor: "#060309" }]}>
        <PaywallGround />
        {body}
      </View>
    );
  }
  const invitation = false;
  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <ScrollView
        contentContainerStyle={[styles.content, {
          paddingTop: insets.top + (invitation ? 28 : 72),
          paddingBottom: insets.bottom + (invitation ? 24 : 48),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>{body}</View>
      </ScrollView>
    </View>
  );
}

const HAIR = "rgba(255,255,255,0.09)";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07040d" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  column: { width: "100%", maxWidth: 480, alignSelf: "center", flexGrow: 1 },
  center: { flex: 1, minHeight: 320, alignItems: "center", justifyContent: "center" },
  title: { ...TypeScale.serifDisplay, color: colors.light.textPrimary, marginBottom: 16 },
  body: { ...TypeScale.bodyLarge, color: colors.light.textSecondary, marginBottom: 14 },
  hint: { ...TypeScale.body, color: colors.light.textTertiary, marginBottom: 14 },
  primary: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 12 },
  secondary: { marginTop: 4 },
  asWritten: { textTransform: "none" },
  legal: { ...TypeScale.metadata, color: colors.light.textTertiary, marginTop: 14, textAlign: "center", fontSize: 11, lineHeight: 16 },

  // ── invitation ──
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 44 },
  eyebrow: { ...TypeScale.eyebrow, color: "rgba(255,255,255,0.55)", letterSpacing: 2 },
  notNow: { ...TypeScale.body, color: "rgba(255,255,255,0.55)" },
  invTitle: { ...TypeScale.serifDisplay, fontSize: 32, lineHeight: 40, color: "rgba(250,244,252,0.96)", marginBottom: 30 },
  evidence: { borderLeftWidth: 1, borderLeftColor: "rgba(224,138,175,0.55)", paddingLeft: 16, paddingVertical: 4, marginBottom: 12 },
  evidenceItem: { ...TypeScale.serifMedium, fontSize: 22, color: "rgba(255,255,255,0.82)", marginBottom: 6 },
  evidenceMeta: { ...TypeScale.metadata, color: "rgba(255,255,255,0.5)" },
  evidenceFoot: { ...TypeScale.metadata, color: "rgba(255,255,255,0.5)", marginBottom: 28 },
  invBody: { ...TypeScale.bodyLarge, color: "rgba(255,255,255,0.84)", marginBottom: 26 },
  rows: { borderTopWidth: 1, borderTopColor: HAIR },
  depthRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12,
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: HAIR,
  },
  rowName: { ...TypeScale.bodyLarge, color: "rgba(255,255,255,0.92)" },
  rowDetail: { ...TypeScale.metadata, color: "rgba(255,255,255,0.5)", flexShrink: 1, textAlign: "right" },
  cta: { minHeight: 58, borderRadius: 29, backgroundColor: ROSE, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  ctaText: { ...TypeScale.bodyLarge, color: "#1b0d17", fontFamily: TypeScale.label.fontFamily },
  ctaQuiet: { backgroundColor: "rgba(224,138,175,0.1)", borderWidth: 1, borderColor: "rgba(224,138,175,0.35)" },
  ctaQuietText: { ...TypeScale.bodyLarge, color: ROSE },
  unavailable: { ...TypeScale.metadata, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 },
  annual: { alignSelf: "center", paddingVertical: 14, minHeight: 44, justifyContent: "center" },
  annualText: { ...TypeScale.body, color: "rgba(255,255,255,0.6)" },
  footRow: { flexDirection: "row", justifyContent: "center", columnGap: 26, marginTop: 4 },
  footLink: { minHeight: 36, justifyContent: "center" },
  footText: { ...TypeScale.body, color: "rgba(255,255,255,0.5)" },
});
