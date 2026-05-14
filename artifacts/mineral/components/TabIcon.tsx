import React from "react";
import Svg, { Circle, Rect } from "react-native-svg";

interface TabIconProps {
  name: "today" | "notes" | "guide" | "origin";
  color: string;
  size?: number;
}

/**
 * Custom tab icons per the Mineral design system.
 * All icons fit in an 18×18 slot.
 * today:  filled circle (presence)
 * notes:  slim slanted rectangle (capture / the stylus)
 * guide:  half-filled circle (reflection / the mirror)
 * origin: ringed dot (the spiral · with center)
 */
export default function TabIcon({ name, color, size = 18 }: TabIconProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;

  switch (name) {
    case "today":
      // Filled circle — full presence
      return (
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <Circle cx={cx} cy={cy} r={r} fill={color} />
        </Svg>
      );

    case "notes":
      // Slim slanted rectangle — the stylus / capture
      return (
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <Rect
            x={s * 0.38}
            y={s * 0.12}
            width={s * 0.24}
            height={s * 0.76}
            rx={s * 0.04}
            fill={color}
            rotation="-15"
            origin={`${cx}, ${cy}`}
          />
        </Svg>
      );

    case "guide":
      // Half-filled circle — the mirror / reflection
      return (
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {/* Unfilled ring */}
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={s * 0.09} />
          {/* Right half fill */}
          <Circle cx={cx} cy={cy} r={r * 0.72} fill={color} />
        </Svg>
      );

    case "origin":
      // Ringed dot — the spiral with center
      return (
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {/* Outer ring */}
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={s * 0.09} />
          {/* Inner dot */}
          <Circle cx={cx} cy={cy} r={r * 0.32} fill={color} />
        </Svg>
      );

    default:
      return null;
  }
}
