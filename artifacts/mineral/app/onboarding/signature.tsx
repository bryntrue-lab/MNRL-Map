import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";
import { savePendingBirthData } from "@/hooks/useOnboarding";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";

const { height } = Dimensions.get("window");

export default function SignatureScreen() {
  const insets = useSafeAreaInsets();

  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");

  const proceed = async (skip = false) => {
    if (!skip && birthDate.trim()) {
      await savePendingBirthData({
        birthDate: birthDate.trim(),
        birthTime: birthTime.trim() || undefined,
        birthLocation: birthLocation.trim() || undefined,
      });
    }
    // The map draws itself next — the payoff of the signature.
    router.push("/onboarding/map");
  };

  const footerBottom = Math.max(insets.bottom, 20) + 36;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Content cluster — vertically centered */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR SIGNATURE</Text>
        <Text style={styles.title}>when did you arrive?</Text>
        <Text style={styles.subtitle}>
          This anchors your timing map into your design.
        </Text>

        {/* Unlocks — minimal, no border or enclosing box */}
        <View style={styles.unlocks}>
          <Text style={styles.unlocksLabel}>UNLOCKS</Text>
          <Text style={styles.unlockItem}>your 28-year cycle</Text>
          <Text style={styles.unlockItem}>your bodygraph + type</Text>
          <Text style={styles.unlockItem}>readings keyed to your design</Text>
        </View>

        {/* Form fields — thinner, lighter */}
        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="birth date"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={birthDate}
            onChangeText={setBirthDate}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="birth time  (optional)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={birthTime}
            onChangeText={setBirthTime}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="birth location  (optional)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={birthLocation}
            onChangeText={setBirthLocation}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => proceed()}
          />
        </View>
      </View>

      {/* Skip — quiet, centered, sits above the footer */}
      <Pressable
        style={[styles.skipWrap, { bottom: footerBottom + 44 }]}
        onPress={() => proceed(true)}
        hitSlop={12}
      >
        <Text style={styles.skipText}>skip · add later</Text>
      </Pressable>

      <OnboardingFooter onContinue={() => proceed()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: height * 0.10,
    paddingBottom: 140,
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 12,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 26,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 32,
  },
  unlocks: {
    marginBottom: 32,
  },
  unlocksLabel: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(168,156,220,0.7)",
    marginBottom: 10,
  },
  unlockItem: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.7)",
  },
  fields: {
    gap: 10,
  },
  input: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    fontFamily: FontFamily.sans400,
  },
  skipWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  skipText: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
  },
});
