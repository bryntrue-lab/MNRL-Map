import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

const LINES = [
  "Each day, a brief encounter.",
  "A reflection of your vision,\nyour voice.",
  "A field guide that grows from\nyour attention, your intention.",
];

export default function SpiralScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Serif italic lines — centered vertically with breathing room */}
        <View style={styles.body}>
          {LINES.map((line, i) => (
            <Text
              key={i}
              style={[
                TypeScale.serifLarge,
                {
                  color: colors.textPrimary,
                  marginBottom: i < LINES.length - 1 ? 36 : 0,
                },
              ]}
            >
              {line}
            </Text>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => router.push("/onboarding/entry")}
        >
          <Text
            style={[
              TypeScale.body,
              {
                color: colors.textPrimary,
                fontFamily: "Inter_500Medium",
                fontSize: 15,
              },
            ]}
          >
            continue →
          </Text>
        </Pressable>
      </View>
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  cta: {
    alignSelf: "flex-end",
  },
});
