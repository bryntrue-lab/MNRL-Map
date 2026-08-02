/**
 * Threshold Begin pill — one of the two §6a CTA surfaces (the other is
 * Origin's encounter affordance). Renders the tokenized Cta component;
 * copy unchanged: eyebrow carries the meta line, title stays "Begin".
 */
import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";

import Cta from "@/components/Cta";

interface BeginButtonProps {
  onPress: () => void;
  meta?: string;
  style?: StyleProp<ViewStyle>;
}

export default function BeginButton({
  onPress,
  meta = "3 MIN · VOICE",
  style,
}: BeginButtonProps) {
  return (
    <Cta
      eyebrow={meta}
      title="Begin"
      onPress={onPress}
      style={style}
      testID="begin-encounter-button"
    />
  );
}
