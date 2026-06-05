import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

import { FontFamily } from "@/constants/typography";

function PlayIcon() {
  return (
    <Svg width={10} height={11} viewBox="0 0 10 11">
      <Polygon points="0,0 0,11 10,5.5" fill="#050208" />
    </Svg>
  );
}

interface BeginButtonProps {
  onPress: () => void;
  meta?: string;
}

export default function BeginButton({
  onPress,
  meta = "3 MIN · VOICE",
}: BeginButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
      onPress={onPress}
      testID="begin-encounter-button"
    >
      <View style={styles.playCircle}>
        <PlayIcon />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Begin</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
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
  textWrap: {
    alignItems: "flex-start",
  },
  label: {
    fontFamily: FontFamily.sans500,
    fontSize: 15,
    color: "#050208",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  meta: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "rgba(5,2,8,0.55)",
    marginTop: 1,
  },
});
