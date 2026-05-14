import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";
import { savePendingBirthData } from "@/hooks/useOnboarding";

export default function SignatureScreen() {
  const colors = useColors();
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
    router.push("/onboarding/practice");
  };

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      borderColor: colors.border,
      backgroundColor: colors.card,
      fontFamily: TypeScale.body.fontFamily,
    },
  ];

  const UNLOCK_ITEMS = [
    "your 28-year cycle",
    "your bodygraph + type",
    "readings keyed to your design",
  ];

  return (
    <AtmosphereBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[TypeScale.eyebrow, { color: colors.textMuted, marginBottom: 20 }]}
        >
          your signature
        </Text>

        <Text
          style={[TypeScale.screenTitle, { color: colors.textPrimary, marginBottom: 12 }]}
        >
          When were you born?
        </Text>

        <Text
          style={[
            TypeScale.body,
            { color: colors.textTertiary, marginBottom: 8, lineHeight: 20 },
          ]}
        >
          This anchors your spiral life map.{"\n"}Your design shapes the guide.
        </Text>

        {/* Unlocks */}
        <View style={[styles.unlocks, { borderColor: colors.border }]}>
          <Text
            style={[
              TypeScale.eyebrow,
              { color: colors.textMuted, marginBottom: 10 },
            ]}
          >
            unlocks
          </Text>
          {UNLOCK_ITEMS.map((item) => (
            <Text
              key={item}
              style={[TypeScale.body, { color: colors.textTertiary, marginBottom: 4 }]}
            >
              {item}
            </Text>
          ))}
        </View>

        {/* Inputs */}
        <View style={styles.inputs}>
          <TextInput
            style={inputStyle}
            placeholder="birth date  e.g. March 1990"
            placeholderTextColor={colors.textMuted}
            value={birthDate}
            onChangeText={setBirthDate}
            returnKeyType="next"
          />
          <TextInput
            style={[inputStyle, { marginTop: 10 }]}
            placeholder="birth time (optional)  e.g. 14:30"
            placeholderTextColor={colors.textMuted}
            value={birthTime}
            onChangeText={setBirthTime}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
          />
          <TextInput
            style={[inputStyle, { marginTop: 10 }]}
            placeholder="birth location  e.g. Chicago, IL"
            placeholderTextColor={colors.textMuted}
            value={birthLocation}
            onChangeText={setBirthLocation}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => proceed()}
          />
        </View>

        {/* Footer actions */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            onPress={() => proceed(true)}
          >
            <Text style={[TypeScale.body, { color: colors.textMuted }]}>
              skip · add later
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            onPress={() => proceed()}
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
        </View>
      </ScrollView>
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    flexGrow: 1,
  },
  unlocks: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  inputs: {
    marginBottom: 32,
  },
  input: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
