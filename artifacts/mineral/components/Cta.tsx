/**
 * Mineral CTA — Slice T §6a (2026-08). The doorway: max ONE per surface.
 * Currently two surfaces own one — Origin's encounter affordance and the
 * Threshold Begin pill. Values are final; do not reopen.
 *
 *   pill    — full-width · r999 · bg rgba(244,240,250,0.97) · padV 16 · padH 24
 *   eyebrow — Inter600 · 11 · UPPERCASE · tracking 1.6 · rgba(10,5,16,0.55)
 *   title   — Cormorant 500 italic · 18 · #0a0510
 *   arrow   — "→" · 18 · rgba(10,5,16,0.6); opacity 0.25 in the COMPLETE
 *             state (quiet acknowledgment — the pill no longer navigates)
 *
 * States: TODAY / CONTINUE / COMPLETE · TOMORROW (the eyebrow carries the
 * state; the component never rewrites the title copy).
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

import { LinkType } from "@/constants/typography";

interface CtaProps {
  /** Uppercase state/meta line: TODAY, CONTINUE, COMPLETE · TOMORROW, 3 MIN · VOICE… */
  eyebrow: string;
  /** Ritual-voice title, rendered as written. */
  title: string;
  onPress?: () => void;
  /** COMPLETE state: arrow dims to 0.25 and the pill does not navigate. */
  complete?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function Cta({
  eyebrow,
  title,
  onPress,
  complete,
  disabled,
  style,
  testID,
}: CtaProps) {
  return (
    <Pressable
      onPress={complete ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        style,
        { opacity: pressed && !complete ? 0.85 : 1 },
      ]}
      testID={testID}
    >
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={[styles.arrow, complete && { opacity: 0.25 }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(244,240,250,0.97)",
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  textWrap: {
    flexShrink: 1,
    gap: 2,
  },
  eyebrow: {
    ...LinkType.ctaEyebrow,
    color: "rgba(10,5,16,0.55)",
  },
  title: {
    ...LinkType.ctaTitle,
    color: "#0a0510",
  },
  arrow: {
    ...LinkType.ctaArrow,
    color: "rgba(10,5,16,0.6)",
  },
});
