import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkPrimary, LinkSecondary } from "@/components/Links";
import colors from "@/constants/colors";
import { SubscriptionCopy as C } from "@/constants/subscriptionCopy";
import { TypeScale } from "@/constants/typography";

export type SubscriptionState = "loading" | "plans" | "confirmed" | "pending" | "not-found" | "unavailable" | "expired";
type Plan = "annual" | "monthly";

export interface SubscriptionViewProps {
  state: SubscriptionState;
  annualPrice?: string;
  monthlyPrice?: string;
  selected: Plan;
  busy: boolean;
  onSelect: (plan: Plan) => void;
  onPurchase: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onContinue: () => void;
  onRenew: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}

const ACCENT = "rgba(224,138,175,0.9)";

function PlanOption({ label, price, suffix, active, disabled, onPress, testID }: {
  label: string; price?: string; suffix: string; active: boolean; disabled: boolean; onPress: () => void; testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={price ? `${label}, ${price}${suffix}` : label}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [styles.plan, active && styles.planActive, { opacity: pressed ? 0.6 : disabled ? 0.5 : 1 }]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioDot} />}</View>
      <Text style={styles.planLabel}>{label}</Text>
      {price ? <Text style={styles.planPrice}>{price}{suffix}</Text> : null}
    </Pressable>
  );
}

function Primary({ label, onPress, busy, testID }: { label: string; onPress: () => void; busy: boolean; testID: string }) {
  if (busy) {
    return (
      <View style={styles.primary} accessibilityRole="progressbar" accessibilityState={{ busy: true }} testID={`${testID}-busy`}>
        <ActivityIndicator size="small" color={ACCENT} />
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

export default function SubscriptionView(p: SubscriptionViewProps) {
  const insets = useSafeAreaInsets();
  const { busy } = p;

  let body: React.ReactNode;
  switch (p.state) {
    case "loading":
      body = <View style={styles.center}><ActivityIndicator color={ACCENT} accessibilityLabel="" /></View>;
      break;
    case "plans":
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{C.plans.title}</Text>
          <Text style={styles.lede}>{C.plans.lede}</Text>
          <Text style={styles.body}>{C.plans.body}</Text>
          <Text style={styles.eyebrow}>{C.plans.choose}</Text>
          <View accessibilityRole="radiogroup" style={styles.plans}>
            <PlanOption label={C.plans.annual} price={p.annualPrice} suffix={C.plans.annualSuffix}
              active={p.selected === "annual"} disabled={busy} onPress={() => p.onSelect("annual")} testID="plan-annual" />
            <PlanOption label={C.plans.monthly} price={p.monthlyPrice} suffix={C.plans.monthlySuffix}
              active={p.selected === "monthly"} disabled={busy} onPress={() => p.onSelect("monthly")} testID="plan-monthly" />
          </View>
          <Primary label={C.plans.purchase} onPress={p.onPurchase} busy={busy} testID="subscription-purchase" />
          <View style={styles.row}>
            <Secondary label={C.plans.restore} onPress={p.onRestore} busy={busy} testID="subscription-restore" />
            <Secondary label={C.plans.notNow} onPress={p.onDismiss} busy={busy} testID="subscription-dismiss" />
          </View>
          <Text style={styles.legal}>{C.plans.legal}</Text>
          <View style={styles.row}>
            <Secondary label={C.plans.privacy} onPress={p.onPrivacy} busy={false} testID="subscription-privacy" />
            <Secondary label={C.plans.terms} onPress={p.onTerms} busy={false} testID="subscription-terms" />
          </View>
        </>
      );
      break;
    case "confirmed":
      body = (
        <>
          <Text style={styles.title} accessibilityRole="header">{C.confirmed.title}</Text>
          <Text style={styles.body}>{C.confirmed.body}</Text>
          <Primary label={C.confirmed.action} onPress={p.onContinue} busy={busy} testID="subscription-continue" />
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
          <Secondary label={c.dismiss} onPress={p.onDismiss} busy={busy} testID="subscription-dismiss" />
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
          <Secondary label={C.expired.dismiss} onPress={p.onDismiss} busy={busy} testID="subscription-dismiss" />
        </>
      );
      break;
  }

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>{body}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050208" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  column: { width: "100%", maxWidth: 480, alignSelf: "center", flexGrow: 1 },
  center: { flex: 1, minHeight: 320, alignItems: "center", justifyContent: "center" },
  title: { ...TypeScale.serifDisplay, color: colors.light.textPrimary, marginBottom: 16 },
  lede: { ...TypeScale.serifMedium, color: "rgba(255,255,255,0.86)", marginBottom: 16 },
  body: { ...TypeScale.bodyLarge, color: colors.light.textSecondary, marginBottom: 14 },
  hint: { ...TypeScale.body, color: colors.light.textTertiary, marginBottom: 14 },
  eyebrow: { ...TypeScale.eyebrow, color: colors.light.textTertiary, marginTop: 28, marginBottom: 12 },
  plans: { gap: 10, marginBottom: 24 },
  plan: {
    flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: 16, gap: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)",
  },
  planActive: { borderColor: "rgba(224,138,175,0.6)", backgroundColor: "rgba(224,138,175,0.07)" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: ACCENT },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  planLabel: { ...TypeScale.sectionTitle, color: colors.light.textPrimary, flex: 1 },
  planPrice: { ...TypeScale.body, color: colors.light.textSecondary },
  primary: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 12 },
  secondary: { marginTop: 4 },
  asWritten: { textTransform: "none" },
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 28, marginTop: 8 },
  legal: { ...TypeScale.metadata, color: colors.light.textTertiary, marginTop: 28 },
});
