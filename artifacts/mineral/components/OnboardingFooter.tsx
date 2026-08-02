import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LinkPrimary } from "@/components/Links";

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
      <LinkPrimary label={continueLabel} onPress={onContinue} />
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
});
