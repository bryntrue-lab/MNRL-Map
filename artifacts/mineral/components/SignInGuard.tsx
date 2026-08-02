import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { LinkPrimary, LinkSecondary } from "@/components/Links";
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

      <LinkPrimary label="keep them first →" onPress={onKeepFirst} testID="guard-keep-first" />
      <LinkSecondary label="sign in anyway" onPress={onProceed} testID="guard-sign-in-anyway" />
      <LinkSecondary label="cancel" onPress={onCancel} testID="guard-cancel" />
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
});
