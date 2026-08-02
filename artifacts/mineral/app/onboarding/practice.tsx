import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { TypeScale } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/map",
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

        {/* Closing thought — no container, quiet centered serif italic */}
        <Text style={styles.closing}>
          {"Your reflections become field notes.\n"}
          {"Patterns become a guide."}
        </Text>
      </View>

      <OnboardingFooter
        activeIndex={4}
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
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
  },
  steps: {
    gap: 28,
    marginBottom: 60,
  },
  step: {},
  stepNum: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  stepName: {
    ...TypeScale.screenTitle,
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  stepDesc: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.58)",
  },
  closing: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    letterSpacing: 0.1,
    paddingHorizontal: 16,
  },
});
