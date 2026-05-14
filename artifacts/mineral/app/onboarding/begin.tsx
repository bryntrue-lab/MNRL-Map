import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AtmosphereBackground from "@/components/AtmosphereBackground";
import AuthSheet from "@/components/AuthSheet";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import {
  clearPendingBirthData,
  getPendingBirthData,
} from "@/hooks/useOnboarding";
import { TypeScale } from "@/constants/typography";

type PendingAction = "begin" | "later";

export default function BeginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUser();

  const [authVisible, setAuthVisible] = useState(false);
  const pendingAction = useRef<PendingAction>("begin");

  const openAuth = (action: PendingAction) => {
    pendingAction.current = action;
    setAuthVisible(true);
  };

  const handleAuthSuccess = async () => {
    setAuthVisible(false);

    // Upload any pending birth data to Firestore
    const birthData = await getPendingBirthData();
    if (birthData) {
      try {
        await updateProfile(birthData);
      } catch {}
      await clearPendingBirthData();
    }

    // Navigate to the main app
    router.replace("/(tabs)");
  };

  return (
    <AtmosphereBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.body}>
          <Text
            style={[
              TypeScale.eyebrow,
              { color: colors.textMuted, marginBottom: 24 },
            ]}
          >
            your first encounter
          </Text>

          <Text
            style={[TypeScale.screenTitle, { color: colors.textPrimary, marginBottom: 12 }]}
          >
            The Threshold
          </Text>

          <Text
            style={[
              TypeScale.serifMedium,
              { color: colors.textTertiary, fontSize: 15, lineHeight: 22, marginBottom: 48 },
            ]}
          >
            something is calling — what comes{"\n"}when you stop naming it?
          </Text>

          {/* Begin button */}
          <Pressable
            style={({ pressed }) => [
              styles.beginBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => openAuth("begin")}
            testID="begin-encounter-button"
          >
            <View style={styles.beginBtnInner}>
              <View style={[styles.beginCircle, { borderColor: "rgba(255,255,255,0.5)" }]} />
              <View style={styles.beginText}>
                <Text
                  style={[
                    TypeScale.body,
                    { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 16 },
                  ]}
                >
                  Begin
                </Text>
                <Text
                  style={[
                    TypeScale.eyebrow,
                    { color: "rgba(255,255,255,0.7)", marginTop: 2 },
                  ]}
                >
                  3 min · voice
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Save for later */}
          <Pressable
            style={({ pressed }) => [styles.later, { opacity: pressed ? 0.5 : 1 }]}
            onPress={() => openAuth("later")}
          >
            <Text style={[TypeScale.body, { color: colors.textMuted }]}>
              save for later
            </Text>
          </Pressable>
        </View>
      </View>

      <AuthSheet
        visible={authVisible}
        onDismiss={() => setAuthVisible(false)}
        onSuccess={handleAuthSuccess}
      />
    </AtmosphereBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  beginBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  beginBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  beginCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  beginText: {
    flex: 1,
  },
  later: {
    alignSelf: "center",
    paddingVertical: 8,
  },
});
