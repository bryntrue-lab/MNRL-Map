import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IntegralAtmosphere } from "@/components/Atmosphere";
import SpiralIndicator from "@/components/SpiralIndicator";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";

// Hardcoded for now — pulls from Firebase user profile later
const USER_DATA = {
  birthYear: 1990,
  birthMonth: "March",
  currentYear: 2026,
  phase: "signal" as const,
  humanDesignType: null as string | null,
};

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

function computeCycle(birthYear: number, currentYear: number) {
  const elapsed = currentYear - birthYear;
  const cycleNumber = Math.floor(elapsed / 28) + 1;
  const yearInCycle = elapsed % 28;
  const cycleLabel = ORDINALS[cycleNumber - 1] ?? `${cycleNumber}th`;
  return { cycleLabel, yearInCycle };
}

export default function OriginScreen() {
  const insets = useSafeAreaInsets();
  const { cycleLabel, yearInCycle } = computeCycle(
    USER_DATA.birthYear,
    USER_DATA.currentYear
  );
  const hasDesign = USER_DATA.humanDesignType !== null;

  const META_ROWS = [
    { label: "born",   value: `${USER_DATA.birthMonth} ${USER_DATA.birthYear}` },
    { label: "phase",  value: `in signal · first turn of the spiral` },
    { label: "cycle",  value: `${cycleLabel} · year ${yearInCycle}` },
    { label: "design", value: USER_DATA.humanDesignType ?? "—" },
  ];

  return (
    <View style={styles.container}>
      <IntegralAtmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTopBar title="ORIGIN" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>your spiral</Text>
          <Text style={styles.subtitle}>
            {USER_DATA.birthMonth} {USER_DATA.birthYear} · cycle {cycleLabel} · year {yearInCycle}
          </Text>
        </View>

        {/* Life map spiral — primary visual */}
        <View style={styles.wheelWrap}>
          <SpiralIndicator phase={USER_DATA.phase} size={220} />
        </View>

        {/* Meta rows */}
        <View style={styles.metaWrap}>
          {META_ROWS.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Design prompt — only shown if birth data not yet provided */}
        {!hasDesign && (
          <Pressable
            style={({ pressed }) => [styles.designPrompt, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => router.push("/onboarding/signature")}
          >
            <Text style={styles.designPromptText}>
              add your birth time and location to reveal your design →
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  scrollContent: {
    paddingHorizontal: 28,
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 26,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(196,186,234,0.7)",
    textAlign: "center",
    letterSpacing: 0.1,
  },

  wheelWrap: {
    alignItems: "center",
    marginBottom: 36,
  },

  metaWrap: {
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  metaLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.35)",
  },
  metaValue: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
  },

  designPrompt: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  designPromptText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(196,186,234,0.65)",
    textAlign: "center",
  },
});
