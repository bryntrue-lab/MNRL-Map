import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

const STEPS = [
  {
    number: "ONE",
    name: "listen",
    description: "a 3-minute voice guide — a threshold, not a lesson",
  },
  {
    number: "TWO",
    name: "reflect",
    description: "speak or write a response",
  },
  {
    number: "THREE",
    name: "integrate",
    description: "one small practice for the day",
  },
];

export default function PracticeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <AtmosphereBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[TypeScale.eyebrow, { color: colors.textMuted, marginBottom: 36 }]}
        >
          each encounter
        </Text>

        {/* Steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View
              key={step.number}
              style={[styles.step, i < STEPS.length - 1 && styles.stepBorder, { borderColor: colors.border }]}
            >
              <Text
                style={[TypeScale.eyebrow, { color: colors.textMuted, marginBottom: 6 }]}
              >
                {step.number}
              </Text>
              <Text
                style={[
                  TypeScale.sectionTitle,
                  { color: colors.textPrimary, marginBottom: 6 },
                ]}
              >
                {step.name}
              </Text>
              <Text
                style={[
                  TypeScale.serifMedium,
                  { color: colors.textTertiary, fontSize: 15, lineHeight: 22 },
                ]}
              >
                {step.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary card */}
        <View
          style={[
            styles.card,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text
            style={[TypeScale.body, { color: colors.textSecondary, lineHeight: 22 }]}
          >
            Your reflections become field notes.{"\n"}Patterns become a guide.
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => router.push("/onboarding/begin")}
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
      </ScrollView>
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    flexGrow: 1,
  },
  steps: {
    marginBottom: 32,
  },
  step: {
    paddingVertical: 24,
  },
  stepBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
  },
  cta: {
    alignSelf: "flex-end",
  },
});
