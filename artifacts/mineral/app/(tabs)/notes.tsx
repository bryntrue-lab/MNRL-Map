import React from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingAtmosphere from "@/components/OnboardingAtmosphere";
import { FontFamily } from "@/constants/typography";

const { width } = Dimensions.get("window");

const CHIPS = [
  { id: "dream",         label: "Dream",         glyph: "◐" },
  { id: "spark",         label: "Spark",         glyph: "✦" },
  { id: "resistance",    label: "Resistance",    glyph: "◬" },
  { id: "symbol",        label: "Symbol",        glyph: "◯" },
  { id: "synchronicity", label: "Synchronicity", glyph: "❋" },
  { id: "vision",        label: "Vision",        glyph: "⌖" },
];

const MORE_CHIPS = ["Desire", "Fear", "Other"];

// Empty for now — wire to Firestore later
const RECENT_NOTES: unknown[] = [];

export default function NotesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <OnboardingAtmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable hitSlop={12}>
            <Text style={styles.iconText}>≡</Text>
          </Pressable>
          <Text style={styles.eyebrow}>NOTES</Text>
          <Pressable hitSlop={12}>
            <Text style={styles.iconText}>⌕</Text>
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What's stirring?</Text>
          <Text style={styles.subtitle}>tap to capture a signal</Text>
        </View>

        {/* Capture chip grid */}
        <View style={styles.chipGrid}>
          {CHIPS.map((chip) => (
            <Pressable
              key={chip.id}
              style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                // Capture sheet — wire when built
              }}
            >
              <Text style={styles.glyph}>{chip.glyph}</Text>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* More row */}
        <Text style={styles.moreLabel}>
          MORE · {MORE_CHIPS.join(" · ").toUpperCase()}
        </Text>

        {/* Recent feed */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentLabel}>RECENT</Text>
            {RECENT_NOTES.length > 0 && (
              <Text style={styles.recentCount}>
                {RECENT_NOTES.length} in your field
              </Text>
            )}
          </View>

          {RECENT_NOTES.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {"your field is empty.\ntap a chip above to capture what's moving."}
              </Text>
            </View>
          ) : (
            RECENT_NOTES.map((_, i) => (
              <View key={i} style={styles.noteItem} />
            ))
          )}
        </View>
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

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  iconText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
  },
  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
  },

  header: {
    marginBottom: 28,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 26,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },

  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    width: (width - 56 - 16) / 3,
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 11,
    alignItems: "center",
  },
  glyph: {
    fontSize: 18,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 8,
    lineHeight: 22,
  },
  chipLabel: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
  },

  moreLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    paddingVertical: 14,
    marginBottom: 24,
  },

  recentSection: {
    marginTop: 12,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  recentLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
  },
  recentCount: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },

  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },

  noteItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
});
