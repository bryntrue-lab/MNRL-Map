import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingAtmosphere from "@/components/OnboardingAtmosphere";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily, TypeScale } from "@/constants/typography";

export default function OriginScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <OnboardingAtmosphere />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <TabTopBar title="ORIGIN" />
        <Text style={[TypeScale.eyebrow, styles.eyebrow]}>the spiral</Text>
        <Text style={[TypeScale.screenTitle, styles.title]}>origin</Text>
        <Text style={[TypeScale.serifMedium, styles.subtitle]}>
          the still point at the center
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: "#C44A8A",
    marginBottom: 12,
  },
  title: {
    color: "rgba(255,255,255,0.95)",
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    marginTop: 8,
  },
});
