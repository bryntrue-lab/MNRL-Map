import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

export default function HelloScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Mark */}
        <View style={styles.mark}>
          <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
            MINERAL
          </Text>
          <Text
            style={[
              TypeScale.serifMedium,
              { color: colors.textTertiary, marginTop: 10 },
            ]}
          >
            a companion for the creative psyche
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => router.push("/onboarding/spiral")}
          testID="begin-button"
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
            begin →
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
  mark: {
    flex: 1,
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 36,
    fontFamily: "Inter_500Medium",
    letterSpacing: 6,
  },
  cta: {
    alignSelf: "flex-end",
  },
});
