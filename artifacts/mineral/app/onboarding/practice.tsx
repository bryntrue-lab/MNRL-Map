import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";

const { height } = Dimensions.get("window");

const STEPS = [
  {
    num: "ONE",
    name: "encounter",
    desc: "a 3-minute voice guide — a threshold, not a lesson",
  },
  {
    num: "TWO",
    name: "reflect",
    desc: "speak or write what's real",
  },
  {
    num: "THREE",
    name: "the field guide",
    desc: "your reflections become field notes; patterns become a guide",
  },
];

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Content cluster — vertically centered */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>EACH ENCOUNTER</Text>

        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.num} style={styles.step}>
              <Text style={styles.stepNum}>{step.num}</Text>
              <Text style={styles.stepName}>{step.name}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>

        {/* Closing thought — one sentence is all the map gets here */}
        <Text style={styles.closing}>
          The timing map holds all of it — a life, ever present.
        </Text>
      </View>

      <OnboardingFooter onContinue={() => router.push("/onboarding/begin")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: height * 0.10,
    paddingBottom: 140,
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 16,
  },
  steps: {
    gap: 28,
    marginBottom: 60,
  },
  step: {},
  stepNum: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 8,
  },
  stepName: {
    fontFamily: FontFamily.sans500,
    fontSize: 22,
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  stepDesc: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.6)",
  },
  closing: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 24,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    letterSpacing: 0.1,
    paddingHorizontal: 16,
  },
});
