import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";

interface TabTopBarProps {
  title: string;
  leftIcon?: string;
  rightIcon?: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}

// C.1 §1d — an icon renders ONLY when it has a real handler. Dead chrome
// (the old default hamburger) is gone; balance is kept with spacers.
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
        <Pressable onPress={onLeftPress} hitSlop={14} style={styles.iconHit}>
          <Text style={styles.iconText}>{leftIcon}</Text>
        </Pressable>
      ) : (
        <View style={styles.iconHit} />
      )}
      <Text style={styles.eyebrow}>{title}</Text>
      {onRightPress ? (
        <Pressable onPress={onRightPress} hitSlop={14} style={styles.iconHit} testID="topbar-right">
          <Text style={styles.iconText}>{rightIcon}</Text>
        </Pressable>
      ) : (
        <View style={styles.iconHit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  iconHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
  },
  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
  },
});
