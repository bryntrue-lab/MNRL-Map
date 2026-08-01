import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { FontFamily } from "@/constants/typography";
import { useUser } from "@/context/UserContext";

const PROMPTED_KEY = "mineral_birthdate_prompted";

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
 * §4 — the one onboarding step of this task. Writes birthDate, then lands on
 * the Origin tab (which plays the first-run choreography). "later" skips.
 */
export default function BirthDateScreen() {
  const { updateProfile } = useUser();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const date = parseBirthDate(value);

  const enter = async () => {
    if (!date || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await updateProfile({ birthDate: Timestamp.fromDate(date) });
      await AsyncStorage.setItem(PROMPTED_KEY, "1").catch(() => {});
      router.replace("/(tabs)/origin");
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  const later = async () => {
    await AsyncStorage.setItem(PROMPTED_KEY, "1").catch(() => {});
    router.replace("/(tabs)/origin");
  };

  return (
    <View style={styles.ground}>
      <KeyboardAvoidingView behavior="padding" style={styles.center}>
        <Text style={styles.eyebrow}>M I N E R A L</Text>
        <Text style={styles.question}>when did you arrive?</Text>

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => setValue(formatDigits(t))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(200,190,225,0.28)"
          keyboardType="number-pad"
          maxLength={10}
          testID="birthdate-input"
        />

        <Pressable
          onPress={enter}
          disabled={!date || saving}
          style={[styles.enterPill, { opacity: date && !saving ? 1 : 0.35 }]}
          testID="birthdate-enter"
        >
          <Text style={styles.enterText}>enter →</Text>
        </Pressable>

        {failed ? (
          <Text style={styles.failed}>not kept — tap enter to try again</Text>
        ) : null}

        <Pressable onPress={later} style={styles.laterWrap} testID="birthdate-later">
          <Text style={styles.laterText}>later</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: "#05030a",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  eyebrow: {
    fontFamily: FontFamily.sans400,
    fontSize: 10,
    letterSpacing: 4,
    color: "rgba(200,190,225,0.45)",
    marginBottom: 26,
  },
  question: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 27,
    color: "rgba(240,235,255,0.92)",
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    width: 210,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.25)",
    color: "rgba(240,235,255,0.9)",
    fontFamily: FontFamily.sans400,
    fontSize: 17,
    letterSpacing: 1.4,
    paddingVertical: 8,
    textAlign: "center",
    marginBottom: 48,
  },
  enterPill: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  enterText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 3.4,
    textTransform: "uppercase",
    color: "rgba(230,220,255,0.75)",
  },
  failed: {
    marginTop: 18,
    fontFamily: FontFamily.sans400,
    fontSize: 10,
    letterSpacing: 1.6,
    color: "rgba(224,86,143,0.6)",
  },
  laterWrap: {
    marginTop: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterText: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.4)",
  },
});
