import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BeginButton from "@/components/BeginButton";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { SpiralIndicator } from "@/components/SpiralComponents";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";

const currentEncounter = {
  phase: "signal" as const,
  title: "The Threshold",
  subtitle: "something is calling — what comes when you stop naming it?",
  durationMin: 3,
};

export default function TodayScreen() {
  const insets = useSafeAreaInsets();

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
        <TabTopBar title="TODAY" />

        {/* Spiral indicator */}
        <View style={styles.spiralWrap}>
          <SpiralIndicator phase={currentEncounter.phase} size={200} />
        </View>

        {/* Encounter content */}
        <View style={styles.encounterCard}>
          <Text style={styles.encounterEyebrow}>TODAY'S ENCOUNTER</Text>
          <Text style={styles.encounterTitle}>{currentEncounter.title}</Text>
          <Text style={styles.encounterSubtitle}>{currentEncounter.subtitle}</Text>

          <BeginButton
            onPress={() => {
              // Encounter flow not yet built — navigate when ready
            }}
            meta={`${currentEncounter.durationMin} MIN · VOICE`}
          />
        </View>

        {/* Past encounters affordance */}
        <Pressable style={styles.pastWrap} onPress={() => {}}>
          <Text style={styles.pastText}>what you've walked through →</Text>
        </Pressable>
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

  encounterCard: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 48,
  },
  encounterEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(196,74,138,0.85)",
    textAlign: "center",
    marginBottom: 12,
  },
  encounterTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 28,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 12,
  },
  encounterSubtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 36,
  },

  pastWrap: {
    alignItems: "center",
    paddingVertical: 12,
  },
  pastText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
  },
});
