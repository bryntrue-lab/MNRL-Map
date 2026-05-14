import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import SpiralIndicator from "@/components/SpiralIndicator";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

export default function EntryScreen() {
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
        <View style={styles.body}>
          <Text
            style={[
              TypeScale.eyebrow,
              { color: colors.textMuted, marginBottom: 48 },
            ]}
          >
            where you're beginning
          </Text>

          {/* Spiral */}
          <View style={styles.spiralWrapper}>
            <SpiralIndicator size={200} phase="signal" animate />
          </View>

          {/* Phase label */}
          <Text
            style={[
              TypeScale.body,
              { color: colors.primary, fontFamily: "Inter_500Medium", marginTop: 24, marginBottom: 4 },
            ]}
          >
            in The Signal
          </Text>
          <Text
            style={[
              TypeScale.eyebrow,
              { color: colors.textMuted },
            ]}
          >
            first turn of the spiral
          </Text>

          {/* Description */}
          <Text
            style={[
              TypeScale.serifMedium,
              {
                color: colors.textSecondary,
                marginTop: 28,
                lineHeight: 22,
                fontSize: 15,
              },
            ]}
          >
            You're entering at The Signal — where the creative call is felt
            before it's named.
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => router.push("/onboarding/signature")}
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
  spiralWrapper: {
    alignItems: "center",
  },
  cta: {
    alignSelf: "flex-end",
  },
});
