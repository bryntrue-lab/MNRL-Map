import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";
import OnboardingAtmosphere from "@/components/OnboardingAtmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/practice",
  "/onboarding/begin",
];

const { height } = Dimensions.get("window");

const STEPS = [
  {
    num: "ONE",
    name: "listen",
    desc: "a 3-minute voice guide — a threshold, not a lesson",
  },
  {
    num: "TWO",
    name: "reflect",
    desc: "speak or write a response — voice is first",
  },
  {
    num: "THREE",
    name: "integrate",
    desc: "one small practice for the day",
  },
];

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <OnboardingAtmosphere />

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

        {/* Closing thought — no container, quiet centered serif italic */}
        <Text style={styles.closing}>
          {"Your reflections become field notes.\n"}
          {"Patterns become a guide."}
        </Text>
      </View>

      <OnboardingFooter
        activeIndex={3}
        routes={ONBOARDING_ROUTES}
        onContinue={() => router.push("/onboarding/begin")}
      />
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
