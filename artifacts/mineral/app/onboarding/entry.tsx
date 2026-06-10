import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";
import { OnboardingSpiral } from "@/components/SpiralComponents";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
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
          <Text style={styles.turnLabel}>FIRST TURN OF THE SPIRAL</Text>
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
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.45)",
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
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 17,
    color: "rgba(196,74,138,0.88)",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  turnLabel: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.42)",
  },
  body: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    maxWidth: 320,
  },
  bodyAccent: {
    color: "rgba(196,74,138,0.88)",
    fontStyle: "italic",
  },
});
