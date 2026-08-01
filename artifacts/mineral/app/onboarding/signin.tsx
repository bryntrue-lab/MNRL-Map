import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { AccountForm } from "@/components/AccountForm";
import { FontFamily } from "@/constants/typography";

/** C.1 §1h — sign in to an existing field from the hello screen. */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Text style={styles.eyebrow}>ALREADY KEEPING A FIELD?</Text>
        <Text style={styles.lead}>sign in, and it returns.</Text>

        <AccountForm mode="signin" onDone={() => router.replace("/(tabs)")} />

        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backLink}
          testID="signin-back"
        >
          <Text style={styles.backText}>← back</Text>
        </Pressable>
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
    paddingHorizontal: 32,
  },
  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 10,
  },
  lead: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 36,
  },
  backLink: {
    marginTop: 32,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.45)",
  },
});
