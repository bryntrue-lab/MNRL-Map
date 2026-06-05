import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import AuthSheet from "@/components/AuthSheet";
import BeginButton from "@/components/BeginButton";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { useUser } from "@/context/UserContext";
import {
  clearPendingBirthData,
  getPendingBirthData,
} from "@/hooks/useOnboarding";
import { FontFamily } from "@/constants/typography";

const { height } = Dimensions.get("window");

type PendingAction = "begin" | "later";

export default function BeginScreen() {
  const { updateProfile } = useUser();

  const [authVisible, setAuthVisible] = useState(false);
  const pendingAction = useRef<PendingAction>("begin");

  const openAuth = (action: PendingAction) => {
    pendingAction.current = action;
    setAuthVisible(true);
  };

  const handleAuthSuccess = async () => {
    setAuthVisible(false);

    const birthData = await getPendingBirthData();
    if (birthData) {
      try {
        await updateProfile(birthData);
      } catch {}
      await clearPendingBirthData();
    }

    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR FIRST ENCOUNTER</Text>
        <Text style={styles.title}>The Threshold</Text>
        <Text style={styles.subtitle}>
          something is calling — what comes when you stop naming it?
        </Text>

        <BeginButton onPress={() => openAuth("begin")} />

        {/* Save for later — quiet secondary */}
        <Pressable
          style={({ pressed }) => [styles.saveWrap, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => openAuth("later")}
          hitSlop={12}
        >
          <Text style={styles.saveText}>save for later</Text>
        </Pressable>
      </View>

      <AuthSheet
        visible={authVisible}
        onDismiss={() => setAuthVisible(false)}
        onSuccess={handleAuthSuccess}
      />
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
    paddingBottom: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(196,74,138,0.85)",
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 30,
    letterSpacing: -0.4,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 48,
  },
  saveWrap: {
    marginTop: 24,
    paddingVertical: 8,
  },
  saveText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
  },
});
