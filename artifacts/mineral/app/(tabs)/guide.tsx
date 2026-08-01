import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";

const LENSES = [
  {
    id: "resistance",
    label: "recurring resistance",
    desc: "patterns of friction across encounters",
    color: "#e08aaf",
  },
  {
    id: "threads",
    label: "threads",
    desc: "phrases that return",
    color: "#88dcba",
  },
  {
    id: "motifs",
    label: "mythic motifs",
    desc: "images and symbols across the field",
    color: "#e9b76b",
  },
  {
    id: "conditions",
    label: "conditions noted",
    desc: "what you name alongside high charge",
    color: "#9bb6d6",
  },
  {
    id: "consciousness",
    label: "consciousness map",
    desc: "where your attention lives across structures",
    color: "#c4baea",
  },
];

// Hardcoded for now — pulls from Firebase later
const FIELD_STATE = {
  signalCount: 0,
  daysIn: 1,
};

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const hasField = FIELD_STATE.signalCount > 0;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTopBar title="FIELD GUIDE" rightIcon="⌕" />

        {/* Field state header */}
        {hasField ? (
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldStateLabel}>YOUR FIELD</Text>
            <Text style={styles.fieldCount}>
              {FIELD_STATE.signalCount} signals · {FIELD_STATE.daysIn} days in
            </Text>
          </View>
        ) : (
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldStateLabelFresh}>● TAKING ROOT</Text>
          </View>
        )}

        {/* Synthesis sentence */}
        <View style={styles.synthesisWrap}>
          <Text style={styles.synthesisText}>
            {hasField
              ? `Your field is beginning to gather. ${FIELD_STATE.signalCount} signals are taking shape across ${FIELD_STATE.daysIn} days of practice.`
              : "Your field begins with your first reflection. Patterns emerge with time and return."}
          </Text>
        </View>

        {/* Lenses */}
        <Text style={styles.lensesLabel}>EXPLORE</Text>
        {LENSES.map((lens) => (
          <Pressable
            key={lens.id}
            style={({ pressed }) => [styles.lensRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              // Lens screen — wire when built
            }}
          >
            <View style={styles.lensLeft}>
              <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
              <View style={styles.lensTextWrap}>
                <Text style={styles.lensName}>{lens.label}</Text>
                <Text style={styles.lensDesc}>{lens.desc}</Text>
              </View>
            </View>
            <Text style={styles.lensArrow}>→</Text>
          </Pressable>
        ))}

        {/* Closing thought — only when field is empty */}
        {!hasField && (
          <Text style={styles.closingThought}>
            {"The Guide grows as you practice.\nReturn here as your field deepens."}
          </Text>
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

  fieldHeader: {
    marginBottom: 20,
  },
  fieldStateLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 6,
  },
  fieldStateLabelFresh: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(196,74,138,0.85)",
    marginBottom: 6,
  },
  fieldCount: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },

  synthesisWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    marginBottom: 36,
  },
  synthesisText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.78)",
  },

  lensesLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  lensRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  lensLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  lensDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  lensTextWrap: {
    flex: 1,
  },
  lensName: {
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 3,
  },
  lensDesc: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 11,
    color: "rgba(255,255,255,0.42)",
  },
  lensArrow: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    marginLeft: 8,
  },

  closingThought: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
