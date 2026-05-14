import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

export default function OriginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={[TypeScale.eyebrow, { color: colors.primary, marginBottom: 12 }]}>
          the spiral
        </Text>
        <Text style={[TypeScale.screenTitle, { color: colors.textPrimary }]}>
          origin
        </Text>
        <Text style={[TypeScale.serifMedium, { color: colors.textTertiary, marginTop: 8 }]}>
          the still point at the center
        </Text>
      </View>
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
