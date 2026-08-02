import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TypeScale } from "@/constants/typography";

interface TabTopBarProps {
  title: string;
  leftIcon?: string;
  rightIcon?: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}

// No dead chrome (§C.1 1d): an icon renders only when it has a real
// handler; otherwise its slot stays as an invisible spacer so the
// title keeps its centered position. Targets are 44×44pt minimum.
export default function TabTopBar({
  title,
  leftIcon = "≡",
  rightIcon = "⊙",
  onLeftPress,
  onRightPress,
}: TabTopBarProps) {
  return (
    <View style={styles.topBar}>
      {onLeftPress ? (
        <Pressable onPress={onLeftPress} style={styles.iconTarget} hitSlop={4}>
          <Text style={styles.iconText}>{leftIcon}</Text>
        </Pressable>
      ) : (
        <View style={styles.iconTarget} />
      )}
      <Text style={styles.eyebrow}>{title}</Text>
      {onRightPress ? (
        <Pressable onPress={onRightPress} style={styles.iconTarget} hitSlop={4}>
          <Text style={styles.iconText}>{rightIcon}</Text>
        </Pressable>
      ) : (
        <View style={styles.iconTarget} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  iconTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    ...TypeScale.screenTitle,
    color: "rgba(255,255,255,0.6)",
  },
  eyebrow: {
    ...TypeScale.metadata,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
  },
});
