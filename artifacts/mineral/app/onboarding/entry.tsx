import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";

const { width, height } = Dimensions.get("window");

// Exact same atmosphere as the splash — screens feel continuous
function ArchaicAtmosphere() {
  return (
    <Svg
      width={width * 2}
      height={height * 0.75}
      style={[styles.atmosphere, { pointerEvents: "none" }]}
    >
      <Defs>
        <RadialGradient
          id="archaicGlow2"
          cx="50%"
          cy="20%"
          rx="60%"
          ry="55%"
          fx="50%"
          fy="20%"
        >
          <Stop offset="0%"   stopColor="#3D1E3D" stopOpacity="0.85" />
          <Stop offset="35%"  stopColor="#2A1530" stopOpacity="0.6" />
          <Stop offset="65%"  stopColor="#1A0D1F" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#050208" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#archaicGlow2)" />
    </Svg>
  );
}

// Full spiral with all cardinal markers, still point, and PHASE I label
function OnboardingSpiral({ size = 200 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 160 160" width={size} height={size}>
      {/* Outer ring */}
      <Circle
        cx="80" cy="80" r="64"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.6"
      />

      {/* North — Phase I · The Signal · ACTIVE — bright with double-ring halo */}
      <Circle cx="80" cy="16" r="14" fill="none" stroke="#c44a8a" strokeWidth="0.5" opacity="0.25" />
      <Circle cx="80" cy="16" r="9"  fill="none" stroke="#c44a8a" strokeWidth="0.6" opacity="0.55" />
      <Circle cx="80" cy="16" r="4"  fill="#c44a8a" />

      {/* East — Phase II · The Field — dim magical green */}
      <Circle cx="144" cy="80" r="2.5" fill="rgba(93,202,165,0.55)" />

      {/* South — Phase III · The Friction — dim mythical amber */}
      <Circle cx="80" cy="144" r="2.5" fill="rgba(216,154,58,0.55)" />

      {/* West — Phase IV · The Voice — dim mental slate */}
      <Circle cx="16" cy="80" r="2.5" fill="rgba(107,142,184,0.55)" />

      {/* Still point center — lavender */}
      <Circle cx="80" cy="80" r="7"   fill="none" stroke="rgba(168,156,220,0.3)" strokeWidth="0.5" />
      <Circle cx="80" cy="80" r="3.5" fill="rgba(168,156,220,0.7)" />

      {/* PHASE I label sits above the active north marker */}
      <SvgText
        x="80"
        y="6"
        textAnchor="middle"
        fill="#c44a8a"
        fontSize="6.5"
        letterSpacing="2"
        fontFamily="System"
      >
        PHASE I
      </SvgText>
    </Svg>
  );
}

export default function EntryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Eyebrow — centered, 10% from top */}
      <Text style={[styles.eyebrow, { marginTop: height * 0.10 }]}>
        WHERE YOU'RE BEGINNING
      </Text>

      {/* Spiral — screen's protagonist */}
      <View style={styles.spiralWrap}>
        <OnboardingSpiral size={width * 0.55} />
      </View>

      {/* Phase label cluster */}
      <View style={styles.labelCluster}>
        <Text style={styles.phaseName}>in The Signal</Text>
        <Text style={styles.turnLabel}>FIRST TURN OF THE SPIRAL</Text>
      </View>

      {/* Body copy — serif italic, manual line break for cadence */}
      <Text style={styles.body}>
        You're entering at The Signal — where the{"\n"}
        creative call is felt before it's named.
      </Text>

      {/* Footer — matches splash: 5 dots, dot 2 active */}
      <View
        style={[
          styles.footer,
          { bottom: Math.max(insets.bottom, 20) + 36 },
        ]}
      >
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Pressable
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          onPress={() => router.push("/onboarding/signature")}
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
    alignItems: "center",
    justifyContent: "flex-start",
  },
  atmosphere: {
    position: "absolute",
    top: 0,
    left: -(width * 0.5),
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
    color: "rgba(196,74,138,0.85)",
    letterSpacing: 0.2,
    marginBottom: 6,
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
