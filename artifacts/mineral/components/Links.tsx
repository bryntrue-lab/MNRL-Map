/**
 * Mineral link species — Slice T §6 (2026-08). Values are final; do not reopen.
 *
 *   LinkPrimary   — this screen/moment's action. Inter600 · 12 · UPPERCASE ·
 *                   tracking 1.8 · always " →" (unless the string carries its
 *                   own terminal glyph) · textPrimary (phase tint permitted via
 *                   `color`) · no underline · press opacity 0.5 · ≥44pt target.
 *   LinkWhisper   — a doorway offered inside held space. Inter400 · 12 ·
 *                   lowercase · tracking 0.5 · always " →" · never underlined ·
 *                   rgba(200,190,225,0.55) (ritual dim-lavender — deliberately
 *                   NOT a text-hierarchy token) · press 0.35 · ≥44pt via
 *                   padding/hitSlop.
 *   LinkSecondary — everything else: choices, dismissals, utilities. Inter400 ·
 *                   13 · lowercase · textSecondary · no textDecorationLine —
 *                   hairline wrapper (borderBottomWidth 1, rgba(255,255,255,0.28),
 *                   paddingBottom 3, alignSelf flex-start) · press: hairline → 0.5.
 *
 * Strings render as written — the species controls case via textTransform,
 * never by rewriting copy. Sanctioned exception (founder ruling, T-b Step 1):
 * `NEED A WAY IN? ↓` keeps its authored uppercase — pass `preserveCase` on
 * LinkSecondary for that one instance only.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import colors from "@/constants/colors";
import { LinkType } from "@/constants/typography";

// A string "ends with its own glyph" when it already terminates in → or ↓ or
// similar; the species then renders it verbatim instead of appending " →".
const TERMINAL_GLYPH = /(→|↓|↑|←)\s*$/;

function withArrow(label: string): string {
  return TERMINAL_GLYPH.test(label) ? label : `${label} →`;
}

interface LinkProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Phase tint (primary only) or rare color override. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  /** Suppress the automatic " →" (primary/whisper). */
  noArrow?: boolean;
  numberOfLines?: number;
}

// ── linkPrimary ─────────────────────────────────────────────
export function LinkPrimary({
  label,
  onPress,
  disabled,
  color,
  style,
  textStyle,
  testID,
  noArrow,
  numberOfLines,
}: LinkProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.primaryTarget,
        style,
        { opacity: pressed ? 0.5 : 1 },
      ]}
      testID={testID}
    >
      <Text
        style={[styles.primaryText, color ? { color } : null, textStyle]}
        numberOfLines={numberOfLines}
      >
        {noArrow ? label : withArrow(label)}
      </Text>
    </Pressable>
  );
}

// ── linkWhisper ─────────────────────────────────────────────
export function LinkWhisper({
  label,
  onPress,
  disabled,
  style,
  textStyle,
  testID,
  noArrow,
  numberOfLines,
}: LinkProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.whisperTarget,
        style,
        { opacity: pressed ? 0.35 : 1 },
      ]}
      testID={testID}
    >
      <Text style={[styles.whisperText, textStyle]} numberOfLines={numberOfLines}>
        {noArrow ? label : withArrow(label)}
      </Text>
    </Pressable>
  );
}

// ── linkSecondary ───────────────────────────────────────────
export function LinkSecondary({
  label,
  onPress,
  disabled,
  style,
  textStyle,
  testID,
  preserveCase,
  numberOfLines,
}: LinkProps & { preserveCase?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={[styles.secondaryTarget, style]}
      testID={testID}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.secondaryHairline,
            // §6d press: only the hairline brightens; the text never dims.
            pressed && { borderBottomColor: "rgba(255,255,255,0.5)" },
          ]}
        >
          <Text
            style={[
              styles.secondaryText,
              preserveCase && { textTransform: "none" },
              textStyle,
            ]}
            numberOfLines={numberOfLines}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  primaryText: {
    ...LinkType.primary,
    color: colors.light.textPrimary,
  },
  whisperTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  whisperText: {
    ...LinkType.whisper,
    color: "rgba(200,190,225,0.55)",
  },
  secondaryTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  secondaryHairline: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.28)",
    paddingBottom: 3,
    alignSelf: "flex-start",
  },
  secondaryText: {
    ...LinkType.secondary,
    color: colors.light.textSecondary,
  },
});
