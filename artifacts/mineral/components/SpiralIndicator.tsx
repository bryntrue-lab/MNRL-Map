import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { Phase } from "@/constants/theme";

interface SpiralIndicatorProps {
  size?: number;
  phase?: Phase;
  animate?: boolean;
}

/**
 * The spiral indicator — a track circle with four cardinal dots and one
 * glowing active position. Used on the Today tab and onboarding entry screen.
 *
 * Spec: 3s pulse loop. Outer ring: 100%→110% radius, opacity 0.5→0.2→0.5.
 */
export default function SpiralIndicator({
  size = 200,
  phase = "signal",
  animate = true,
}: SpiralIndicatorProps) {
  const colors = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  const trackColor = "rgba(255,255,255,0.12)";
  const dotMuted = "rgba(255,255,255,0.2)";
  const accent = colors.primary;

  // Cardinal positions
  const cardinals: Record<Phase, { x: number; y: number }> = {
    signal: { x: cx, y: cy - r },
    field: { x: cx + r, y: cy },
    friction: { x: cx, y: cy + r },
    voice: { x: cx - r, y: cy },
  };

  const activePos = cardinals[phase];

  // Pulse ring animation
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (!animate) return;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [animate, pulseScale, pulseOpacity]);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const pulseRingSize = size * 0.12;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={1}
        />

        {/* Muted cardinal dots — all four positions */}
        {Object.entries(cardinals).map(([p, pos]) =>
          p !== phase ? (
            <Circle
              key={p}
              cx={pos.x}
              cy={pos.y}
              r={size * 0.018}
              fill={dotMuted}
            />
          ) : null
        )}

        {/* Active dot */}
        <Circle
          cx={activePos.x}
          cy={activePos.y}
          r={size * 0.026}
          fill={accent}
        />
      </Svg>

      {/* Animated pulse ring — positioned at active dot */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: pulseRingSize,
            height: pulseRingSize,
            borderRadius: pulseRingSize / 2,
            borderColor: accent,
            top: activePos.y - pulseRingSize / 2,
            left: activePos.x - pulseRingSize / 2,
          },
          animatedRingStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    position: "absolute",
    borderWidth: 1,
  },
});
