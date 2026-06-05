import React from "react";
import {
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
const ORIGIN_DATA = {
  born: "—",               // e.g. "march 12, 1989"
  phase: "in signal",      // current phase name
  turn: "first turn of the spiral",
  now: "day 1",            // days since first encounter
  design: "—",             // birth-anchored design type (future)
};

const META_ROWS: { label: string; value: string }[] = [
  { label: "born",   value: ORIGIN_DATA.born },
  { label: "phase",  value: `${ORIGIN_DATA.phase} · ${ORIGIN_DATA.turn}` },
  { label: "now",    value: ORIGIN_DATA.now },
  { label: "design", value: ORIGIN_DATA.design },
];

export default function OriginScreen() {
  const insets = useSafeAreaInsets();

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

        {/* Life map spiral — the screen's primary visual */}
        <View style={styles.spiralWrap}>
          <SpiralIndicator phase="signal" size={220} />
          <Text style={styles.spiralCaption}>
            {ORIGIN_DATA.phase} · {ORIGIN_DATA.turn}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Origin meta rows */}
        {META_ROWS.map((row) => (
          <View key={row.label} style={styles.metaRow}>
            <Text style={styles.metaLabel}>{row.label}</Text>
            <Text style={styles.metaValue}>{row.value}</Text>
          </View>
        ))}

        {/* Still point — closing line */}
        <Text style={styles.stillPoint}>
          the still point at the center
        </Text>
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

  spiralWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  spiralCaption: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 12,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.4)",
    marginTop: 14,
    textAlign: "center",
  },

  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 28,
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

  stillPoint: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 12,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
