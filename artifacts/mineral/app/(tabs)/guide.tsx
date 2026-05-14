import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

export default function GuideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={[TypeScale.eyebrow, { color: colors.primary, marginBottom: 12 }]}>
          your field
        </Text>
        <Text style={[TypeScale.screenTitle, { color: colors.textPrimary }]}>
          guide
        </Text>
        <Text style={[TypeScale.serifMedium, { color: colors.textTertiary, marginTop: 8 }]}>
          patterns reflected back
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
