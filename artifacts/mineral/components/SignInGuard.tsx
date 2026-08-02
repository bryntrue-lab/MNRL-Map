import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TypeScale } from "@/constants/typography";

/**
 * Task C §2 guard — shown only when the current ANONYMOUS session holds
 * ≥1 fieldNote and the user reaches for "sign in". Signing in to another
 * field abandons those notes; there is no merge in v1 — this warning is
 * the whole protection.
 */
export function SignInGuard({
  onKeepFirst,
  onProceed,
  onCancel,
}: {
  onKeepFirst: () => void;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <View testID="sign-in-guard">
      <Text style={styles.headline}>this device holds notes that aren&apos;t kept.</Text>
      <Text style={styles.body}>
        Signing in to another field will leave them behind — there&apos;s no way
        to bring them along.
      </Text>

      <Pressable onPress={onKeepFirst} style={styles.action} hitSlop={4} testID="guard-keep-first">
        <Text style={styles.primaryText}>keep them first →</Text>
      </Pressable>
      <Pressable onPress={onProceed} style={styles.action} hitSlop={4} testID="guard-sign-in-anyway">
        <Text style={styles.quietText}>sign in anyway</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.action} hitSlop={4} testID="guard-cancel">
        <Text style={styles.quietText}>cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.88)",
    marginBottom: 10,
  },
  body: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.58)",
    marginBottom: 20,
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  primaryText: {
    ...TypeScale.body,
    letterSpacing: 0.4,
    color: "rgba(235,228,255,0.9)",
  },
  quietText: {
    ...TypeScale.label,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.5)",
  },
});
