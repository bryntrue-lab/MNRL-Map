import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";

interface OnboardingFooterProps {
  activeIndex: number;
  routes: string[];
  onContinue: () => void;
  continueLabel?: string;
}

export default function OnboardingFooter({
  activeIndex,
  routes,
  onContinue,
  continueLabel = "continue →",
}: OnboardingFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { bottom: Math.max(insets.bottom, 20) + 36 }]}>
      <View style={styles.dots}>
        {routes.map((route, i) => {
          const isActive = i === activeIndex;
          return (
            <Pressable
              key={i}
              onPress={() => !isActive && router.push(route as any)}
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed && !isActive ? 0.5 : 1,
              })}
            >
              <View style={[styles.dot, isActive && styles.dotActive]} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
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
