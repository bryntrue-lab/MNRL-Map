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

export default function TabTopBar({
  title,
  leftIcon = "≡",
  rightIcon = "⊙",
  onLeftPress,
  onRightPress,
}: TabTopBarProps) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onLeftPress} hitSlop={12}>
        <Text style={styles.iconText}>{leftIcon}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{title}</Text>
      <Pressable onPress={onRightPress} hitSlop={12}>
        <Text style={styles.iconText}>{rightIcon}</Text>
      </Pressable>
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
