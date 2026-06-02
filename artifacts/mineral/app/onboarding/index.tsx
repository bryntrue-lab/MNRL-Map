import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { FontFamily } from "@/constants/typography";

// The Mineral wordmark — Radiometry typeface rendered as inline SVG paths.
// viewBox 259.2 × 52.05 — all seven glyphs (M I N E R A L).
function MineralWordmark({ width = 220 }: { width?: number }) {
  const height = width * (52.05 / 259.2);
  return (
    <Svg viewBox="0 0 259.2 52.05" width={width} height={height} fill="white">
      {/* A — distinctive triangular form */}
      <Path d="M204.24,52.05l-9.16-17.02-6.63,14.82h-5.98L204.37.73l22.22,49.12h-5.98l-6.69-14.82-9.68,17.02ZM204.37,14.02l-6.5,14.65,6.5,11.94,6.69-11.94-6.69-14.65Z" />
      {/* M */}
      <Path d="M42.64.13v49.88h-5.5v-28.49l-15.82,28.71L5.5,21.52v28.49H0V.13l21.32,38.69L42.64.13Z" />
      {/* I */}
      <Path d="M49.82,50.01V.5h5.5v49.5h-5.5Z" />
      {/* N */}
      <Path d="M98.95.5v50.02l-30.95-35.76v35.24h-5.5V0l30.95,35.76V.5h5.5Z" />
      {/* E */}
      <Path d="M111.63,6.01v16.51h20.52v5.5h-20.52v16.49h23.96v5.5h-29.46V.51h29.46v5.5h-23.96Z" />
      {/* R */}
      <Path d="M178.31,50.01h-6.68l-15.14-22h-8.22v21.99h-5.5V.5h19.26c7.39-.02,13.46,5.81,13.76,13.19s-5.29,13.68-12.65,14.26l15.18,22.05ZM162.03,22.51c3,.08,5.8-1.48,7.32-4.06,1.52-2.58,1.52-5.79,0-8.38-1.52-2.58-4.33-4.14-7.32-4.06h-13.75v16.5h13.75Z" />
      {/* L */}
      <Path d="M259.2,44.5v5.5h-27.51V.5h5.5v44h22.01Z" />
    </Svg>
  );
}

// Six onboarding progress dots. First dot is elongated + bright; rest are small + dim.
function ProgressDots({ active = 0, total = 6 }: { active?: number; total?: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

export default function HelloScreen() {
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      {/* Center: wordmark + tagline */}
      <View style={styles.center}>
        <MineralWordmark width={220} />
        <Text style={styles.tagline}>a companion for the creative psyche</Text>
      </View>

      {/* Footer: progress dots left, begin right */}
      <View
        style={[
          styles.footer,
          { bottom: Math.max(insets.bottom, 32) + 16 },
        ]}
      >
        <ProgressDots active={0} total={6} />
        <Pressable
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          onPress={() => router.push("/onboarding/spiral")}
          testID="begin-button"
          hitSlop={12}
        >
          <Text style={styles.beginText}>begin →</Text>
        </Pressable>
      </View>
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  tagline: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 18,
  },
  footer: {
    position: "absolute",
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    borderRadius: 2,
    height: 4,
  },
  dotActive: {
    width: 14,
    backgroundColor: "rgba(255,255,255,1)",
  },
  dotInactive: {
    width: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  beginText: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.3,
  },
});
