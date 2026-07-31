import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";

interface OnboardingFooterProps {
  onContinue: () => void;
  continueLabel?: string;
}

/**
 * The onboarding advance affordance — one quiet button, bottom-right.
 * No progress dots or percentages: onboarding is a threshold sequence,
 * not a process bar (chapel rule — timing, not progress).
 */
export default function OnboardingFooter({
  onContinue,
  continueLabel = "continue →",
}: OnboardingFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { bottom: Math.max(insets.bottom, 20) + 36 }]}>
      <Pressable
        style={({ pressed }) => [styles.continueHit, { opacity: pressed ? 0.5 : 1 }]}
        onPress={onContinue}
        hitSlop={12}
      >
        <Text style={styles.continueText}>{continueLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  continueHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  continueText: {
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.4,
  },
});
