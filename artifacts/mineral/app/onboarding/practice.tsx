import { router } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";

const { width, height } = Dimensions.get("window");

function ArchaicAtmosphere() {
  return (
    <Svg
      width={width * 2}
      height={height * 0.75}
      style={[styles.atmosphere, { pointerEvents: "none" }]}
    >
      <Defs>
        <RadialGradient id="archaicGlow4" cx="50%" cy="20%" rx="60%" ry="55%" fx="50%" fy="20%">
          <Stop offset="0%"   stopColor="#3D1E3D" stopOpacity="0.85" />
          <Stop offset="35%"  stopColor="#2A1530" stopOpacity="0.6" />
          <Stop offset="65%"  stopColor="#1A0D1F" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#050208" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#archaicGlow4)" />
    </Svg>
  );
}

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
  const insets = useSafeAreaInsets();
  const footerBottom = Math.max(insets.bottom, 20) + 36;

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

      {/* Footer — 5 dots, dot 4 active */}
      <View style={[styles.footer, { bottom: footerBottom }]}>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>
        <Pressable
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          onPress={() => router.push("/onboarding/begin")}
          hitSlop={12}
        >
          <Text style={styles.continueText}>continue →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  atmosphere: {
    position: "absolute",
    top: 0,
    left: -(width * 0.5),
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
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dotActive: {
    width: 22,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,1)",
  },
  continueText: {
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.4,
  },
});
