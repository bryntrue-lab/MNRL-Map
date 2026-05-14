import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";

interface AtmosphereBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * The atmospheric ground for all Mineral screens.
 * Phase I (Signal): deep #0a0510 → #1a0a18 with subtle #C44A8A glow.
 * Other phases will get their own tints in a later version.
 */
export default function AtmosphereBackground({
  children,
  style,
}: AtmosphereBackgroundProps) {
  const colors = useColors();

  return (
    <LinearGradient
      colors={["#0a0510", "#1a0a18"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.root, style]}
    >
      {/* Subtle signal glow — top radial bloom */}
      <View style={[styles.glow, { backgroundColor: colors.glowColor }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glow: {
    position: "absolute",
    top: -120,
    left: "50%",
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
});
