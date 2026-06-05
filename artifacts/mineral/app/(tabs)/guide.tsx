import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingAtmosphere from "@/components/OnboardingAtmosphere";
import { FontFamily, TypeScale } from "@/constants/typography";

export default function GuideScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <OnboardingAtmosphere />
      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <Text style={[TypeScale.eyebrow, styles.eyebrow]}>your field</Text>
        <Text style={[TypeScale.screenTitle, styles.title]}>guide</Text>
        <Text style={[TypeScale.serifMedium, styles.subtitle]}>
          patterns reflected back
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
