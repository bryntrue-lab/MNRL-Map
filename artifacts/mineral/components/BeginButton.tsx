/**
 * The compact Begin pill — the SECOND §6a CTA variant (T-c §2 restores
 * v6's form; the full-width announcement variant stays with Origin's
 * encounter affordance in components/Cta.tsx).
 *
 *   container — hugs content · alignSelf center · r999 · padV 14 · padH 28 ·
 *               ground rgba(244,240,250,0.97)
 *   circle    — 34pt, phase-accent tint, small dark play triangle
 *   title     — "Begin" · Inter 500 · 19 · #0a0510 (T-c §8: no serif
 *               inside an interactive control)
 *   meta      — Inter 500 · 10 · UPPERCASE · tracking 1.4 · rgba(10,5,16,0.55)
 *   no trailing arrow — the play glyph is the signifier.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";

import { LinkType } from "@/constants/typography";

function PlayIcon() {
  return (
    <Svg width={11} height={12} viewBox="0 0 10 11">
      <Polygon points="0,0 0,11 10,5.5" fill="#0a0510" />
    </Svg>
  );
}

interface BeginButtonProps {
  onPress: () => void;
  meta?: string;
  /** Phase accent for the play-circle tint (Signal default). */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

export default function BeginButton({
  onPress,
  meta = "3 min · voice",
  accent = "#C44A8A",
  style,
}: BeginButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, style, { opacity: pressed ? 0.85 : 1 }]}
      onPress={onPress}
      testID="begin-encounter-button"
    >
      <View style={[styles.playCircle, { backgroundColor: `${accent}38` }]}>
        <PlayIcon />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Begin</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(244,240,250,0.97)",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  textWrap: {
    alignItems: "flex-start",
  },
  title: {
    ...LinkType.ctaBeginTitle,
    color: "#0a0510",
  },
  meta: {
    ...LinkType.ctaBeginMeta,
    color: "rgba(10,5,16,0.55)",
    marginTop: 1,
  },
});
