import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingAtmosphere from "@/components/OnboardingAtmosphere";
import SpiralIndicator from "@/components/SpiralIndicator";
import { FontFamily } from "@/constants/typography";

const { height } = Dimensions.get("window");

function PlayIcon() {
  return (
    <Svg width={10} height={11} viewBox="0 0 10 11">
      <Polygon points="0,0 0,11 10,5.5" fill="#050208" />
    </Svg>
  );
}

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
          <Text style={styles.eyebrow}>TODAY</Text>
          <Pressable hitSlop={12}>
            <Text style={styles.iconText}>⊙</Text>
          </Pressable>
        </View>

        {/* Spiral indicator */}
        <View style={styles.spiralWrap}>
          <SpiralIndicator phase={currentEncounter.phase} size={200} />
        </View>

        {/* Encounter content */}
        <View style={styles.encounterCard}>
          <Text style={styles.encounterEyebrow}>TODAY'S ENCOUNTER</Text>
          <Text style={styles.encounterTitle}>{currentEncounter.title}</Text>
          <Text style={styles.encounterSubtitle}>{currentEncounter.subtitle}</Text>

          <Pressable
            style={({ pressed }) => [styles.beginButton, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => {
              // Encounter flow not yet built — navigate when ready
            }}
          >
            <View style={styles.playCircle}>
              <PlayIcon />
            </View>
            <View style={styles.beginTextWrap}>
              <Text style={styles.beginLabel}>Begin</Text>
              <Text style={styles.beginMeta}>{currentEncounter.durationMin} MIN · VOICE</Text>
            </View>
          </Pressable>
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

  beginButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    minWidth: 180,
    justifyContent: "center",
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(196,74,138,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  beginTextWrap: {
    alignItems: "flex-start",
  },
  beginLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 15,
    color: "#050208",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  beginMeta: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "rgba(5,2,8,0.55)",
    marginTop: 1,
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
