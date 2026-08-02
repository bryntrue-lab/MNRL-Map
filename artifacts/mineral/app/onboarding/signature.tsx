import { router, useLocalSearchParams } from "expo-router";
import { Timestamp } from "firebase/firestore";
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
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";
import { useUser } from "@/context/UserContext";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/map",
  "/onboarding/practice",
  "/onboarding/begin",
];

const { height } = Dimensions.get("window");

/** Digits → YYYY-MM-DD as the user types. */
function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function parseBirthDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Noon local time — keeps the calendar day stable across time zones.
  const date = new Date(y, mo - 1, d, 12);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

/**
 * Slice 5 — the app's ONLY birth-date form, ever. Writes
 * users/{uid}.birthDate (+ optional time) directly: one source of truth.
 * Reached from onboarding step 3, and from the Origin tab's empty state
 * (from=origin), which returns there after saving.
 */
export default function SignatureScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUser();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOrigin = from === "origin";

  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const parsed = parseBirthDate(birthDate);

  const leave = () => {
    if (fromOrigin) {
      // Back to the map — with a birth date, the choreography now plays there.
      router.back();
    } else {
      router.push("/onboarding/map");
    }
  };

  const proceed = async (skip = false) => {
    if (saving) return;
    if (skip || !parsed) {
      leave();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      await updateProfile({
        birthDate: Timestamp.fromDate(parsed),
        ...(birthTime.trim() ? { birthTime: birthTime.trim() } : {}),
        // birthLocation stays local-only until the structured schema
        // ({ lat, lng, label }) is wired — a plain string doesn't map.
      });
      leave();
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  const footerBottom = Math.max(insets.bottom, 20) + 36;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Content cluster — vertically centered */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR SIGNATURE</Text>
        <Text style={styles.title}>When were you born?</Text>
        <Text style={styles.subtitle}>This anchors your spiral life map.</Text>

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
            placeholder="birth date  (YYYY-MM-DD)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={birthDate}
            onChangeText={(t) => setBirthDate(formatDigits(t))}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="next"
            testID="signature-birthdate"
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
            placeholder="birth location"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={birthLocation}
            onChangeText={setBirthLocation}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => proceed()}
          />
        </View>

        {failed ? (
          <Text style={styles.failed}>not kept — try again</Text>
        ) : null}
      </View>

      {/* Skip — quiet, centered, sits above the footer */}
      {!fromOrigin && (
        <Pressable
          style={[styles.skipWrap, { bottom: footerBottom + 44 }]}
          onPress={() => proceed(true)}
          hitSlop={12}
          testID="signature-skip"
        >
          <Text style={styles.skipText}>skip · add later</Text>
        </Pressable>
      )}

      {fromOrigin ? (
        <View style={[styles.originFooter, { bottom: footerBottom }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} testID="signature-cancel">
            <Text style={styles.skipText}>not now</Text>
          </Pressable>
          <Pressable
            onPress={() => proceed()}
            disabled={!parsed || saving}
            hitSlop={12}
            style={{ opacity: parsed && !saving ? 1 : 0.35 }}
            testID="signature-save"
          >
            <Text style={styles.saveText}>save →</Text>
          </Pressable>
        </View>
      ) : (
        <OnboardingFooter
          activeIndex={2}
          routes={ONBOARDING_ROUTES}
          onContinue={() => proceed()}
        />
      )}
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
    color: "rgba(196,74,138,0.85)",
    marginBottom: 14,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 26,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.96)",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 28,
  },
  unlocks: {
    marginBottom: 28,
  },
  unlocksLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 10,
  },
  unlockItem: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.65)",
  },
  fields: {
    gap: 12,
  },
  input: {
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
  },
  failed: {
    marginTop: 12,
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1,
    color: "rgba(224,138,175,0.8)",
  },
  skipWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  skipText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
  },
  originFooter: {
    position: "absolute",
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  saveText: {
    fontFamily: FontFamily.sans500,
    fontSize: 14,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.92)",
  },
});
