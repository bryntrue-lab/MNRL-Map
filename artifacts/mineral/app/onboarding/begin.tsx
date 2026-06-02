import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import AuthSheet from "@/components/AuthSheet";
import { useUser } from "@/context/UserContext";
import {
  clearPendingBirthData,
  getPendingBirthData,
} from "@/hooks/useOnboarding";
import { FontFamily } from "@/constants/typography";

const { width, height } = Dimensions.get("window");

type PendingAction = "begin" | "later";

function ArchaicAtmosphere() {
  return (
    <Svg
      width={width * 2}
      height={height * 0.75}
      style={[styles.atmosphere, { pointerEvents: "none" }]}
    >
      <Defs>
        <RadialGradient id="archaicGlow5" cx="50%" cy="20%" rx="60%" ry="55%" fx="50%" fy="20%">
          <Stop offset="0%"   stopColor="#3D1E3D" stopOpacity="0.85" />
          <Stop offset="35%"  stopColor="#2A1530" stopOpacity="0.6" />
          <Stop offset="65%"  stopColor="#1A0D1F" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#050208" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#archaicGlow5)" />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={10} height={11} viewBox="0 0 10 11">
      <Polygon points="0,0 0,11 10,5.5" fill="#050208" />
    </Svg>
  );
}

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

      {/* Centered content cluster */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR FIRST ENCOUNTER</Text>
        <Text style={styles.title}>The Threshold</Text>
        <Text style={styles.subtitle}>
          something is calling — what comes when you stop naming it?
        </Text>

        {/* Begin button — restrained near-white pill */}
        <Pressable
          style={({ pressed }) => [styles.beginButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => openAuth("begin")}
          testID="begin-encounter-button"
        >
          <View style={styles.playCircle}>
            <PlayIcon />
          </View>
          <View style={styles.beginTextWrap}>
            <Text style={styles.beginLabel}>Begin</Text>
            <Text style={styles.beginMeta}>3 MIN · VOICE</Text>
          </View>
        </Pressable>

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
  atmosphere: {
    position: "absolute",
    top: 0,
    left: -(width * 0.5),
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
  beginButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    minWidth: 180,
    justifyContent: "center",
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(196,74,138,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  beginTextWrap: {
    alignItems: "flex-start",
  },
  beginLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 15,
    color: "#050208",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  beginMeta: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "rgba(5,2,8,0.55)",
    marginTop: 1,
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
