import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
const INK = "#1b0d17";

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

function FooterLink({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" hitSlop={10} testID={testID}
      style={({ pressed }) => [styles.footLink, { opacity: disabled ? 0.35 : pressed ? 0.5 : 1 }]}>
      <Text style={styles.footText}>{label}</Text>
    </Pressable>
  );
}

function Invitation(p: SubscriptionViewProps) {
  const I = C.invitation;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [rise]);
  const canBuy = p.offer === "ready" && p.purchasesEnabled && !p.busy && !!p.monthlyPrice && !!p.annualPrice;

  return (
    <Animated.View style={{ flexGrow: 1, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{I.eyebrow.toUpperCase()}</Text>
        <Pressable onPress={p.onDismiss} hitSlop={14} accessibilityRole="button"
          accessibilityLabel={C.plans.notNow} testID="subscription-dismiss"
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text style={styles.notNow}>{I.notNow}</Text>
        </Pressable>
      </View>

      <Text style={styles.invTitle} accessibilityRole="header">{I.title}</Text>

      {p.evidence ? (
        <View testID="invitation-evidence">
          <View style={styles.evidence}>
            <Text style={styles.evidenceItem}>{displayItem(p.evidence.item)}</Text>
            <Text style={styles.evidenceMeta}>{I.returned(spellNumber(p.evidence.count))}</Text>
          </View>
          <Text style={styles.evidenceFoot}>{I.fromNotes(spellNumber(p.evidence.notes))}</Text>
        </View>
      ) : null}

      <Text style={styles.invBody}>{I.body}</Text>

      <View style={styles.rows}>
        {I.rows.map((r) => (
          <View key={r.name} style={styles.depthRow}>
            <Text style={styles.rowName}>{r.name}</Text>
            <Text style={styles.rowDetail}>{r.detail}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexGrow: 1, minHeight: 40 }} />

      {p.offer === "loading" ? (
        <View style={[styles.cta, styles.ctaQuiet]} testID="subscription-offer-loading">
          <ActivityIndicator size="small" color={ROSE} />
        </View>
      ) : p.offer === "unavailable" ? (
        <View testID="subscription-offer-unavailable">
          <Text style={styles.unavailable}>{C.unavailable.body}</Text>
          <Pressable onPress={p.onRetryOffer} hitSlop={10} accessibilityRole="button" testID="subscription-retry"
            style={({ pressed }) => [styles.cta, styles.ctaQuiet, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={styles.ctaQuietText}>{C.unavailable.action}</Text>
          </Pressable>
        </View>
      ) : p.busy ? (
        <View style={styles.cta} accessibilityRole="progressbar" accessibilityState={{ busy: true }} testID="subscription-purchase-busy">
          <ActivityIndicator size="small" color={INK} />
        </View>
      ) : (
        <>
          <Pressable onPress={p.onPurchaseMonthly} disabled={!canBuy} accessibilityRole="button"
            accessibilityState={{ disabled: !canBuy }} testID="subscription-purchase-monthly"
            style={({ pressed }) => [styles.cta, { opacity: !canBuy ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
            <Text style={styles.ctaText}>{I.monthly(p.monthlyPrice ?? "")}</Text>
          </Pressable>
          <Pressable onPress={p.onPurchaseAnnual} disabled={!canBuy} accessibilityRole="button"
            accessibilityState={{ disabled: !canBuy }} hitSlop={8} testID="subscription-purchase-annual"
            style={({ pressed }) => [styles.annual, { opacity: !canBuy ? 0.4 : pressed ? 0.5 : 1 }]}>
            <Text style={styles.annualText}>{I.annual(p.annualPrice ?? "")}</Text>
          </Pressable>
        </>
      )}

      <View style={styles.footRow}>
        <FooterLink label={I.restore} onPress={p.onRestore} disabled={p.busy} testID="subscription-restore" />
        <FooterLink label={I.terms} onPress={p.onTerms} testID="subscription-terms" />
        <FooterLink label={I.privacy} onPress={p.onPrivacy} disabled={!p.privacyAvailable} testID="subscription-privacy" />
      </View>
      <View style={styles.footRow}>
        <FooterLink label={I.redeem} onPress={p.onRedeem} disabled={p.busy || !p.purchasesEnabled} testID="subscription-redeem" />
      </View>
      <Text style={styles.legal}>{C.plans.legal}</Text>
    </Animated.View>
  );
}

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

  const invitation = p.state === "plans";
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
  ctaText: { ...TypeScale.bodyLarge, color: INK, fontFamily: TypeScale.label.fontFamily },
  ctaQuiet: { backgroundColor: "rgba(224,138,175,0.1)", borderWidth: 1, borderColor: "rgba(224,138,175,0.35)" },
  ctaQuietText: { ...TypeScale.bodyLarge, color: ROSE },
  unavailable: { ...TypeScale.metadata, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 },
  annual: { alignSelf: "center", paddingVertical: 14, minHeight: 44, justifyContent: "center" },
  annualText: { ...TypeScale.body, color: "rgba(255,255,255,0.6)" },
  footRow: { flexDirection: "row", justifyContent: "center", columnGap: 26, marginTop: 4 },
  footLink: { minHeight: 36, justifyContent: "center" },
  footText: { ...TypeScale.body, color: "rgba(255,255,255,0.5)" },
});
