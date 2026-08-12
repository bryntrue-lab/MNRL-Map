import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { TypeScale } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";
import { OnboardingSpiral } from "@/components/SpiralComponents";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/map",
  "/onboarding/practice",
  "/onboarding/begin",
];

const { width, height } = Dimensions.get("window");

export default function EntryScreen() {
  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Content cluster — flex:1 + justifyContent:center lands it at optical center */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>WHERE YOU'RE BEGINNING</Text>

        <View style={styles.spiralWrap}>
          <OnboardingSpiral />
        </View>

        {/* Phase label cluster between spiral and body */}
        <View style={styles.labelCluster}>
          <Text style={styles.phaseName}>in The Signal</Text>
          <Text style={styles.turnLabel}>YOUR FIRST TURN</Text>
        </View>

        {/* Body copy — only "The Signal" highlighted in phase pink */}
        <Text style={styles.body}>
          {"You're entering at "}
          <Text style={styles.bodyAccent}>The Signal</Text>
          {" — where the creative call is felt before it's named."}
        </Text>
      </View>

      <OnboardingFooter
        activeIndex={1}
        routes={ONBOARDING_ROUTES}
        onContinue={() => router.push("/onboarding/signature")}
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
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 32,
  },
  spiralWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  labelCluster: {
    alignItems: "center",
    marginBottom: 22,
  },
  phaseName: {
    ...TypeScale.serifBody,
    color: "#E08AAF",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  turnLabel: {
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
  },
  body: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    maxWidth: 320,
  },
  bodyAccent: {
    color: "#E08AAF",
  },
});
