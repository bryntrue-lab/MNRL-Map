import React from "react";
import Svg, { Circle, ClipPath, Defs, G, Rect } from "react-native-svg";

interface TabIconProps {
  name: "today" | "notes" | "guide" | "origin";
  color: string;
  size?: number;
}

/**
 * Mineral design system tab icons — fixed 24×24 viewBox.
 * today:  filled circle
 * notes:  slim rectangle (4×16px, rotated -22°)
 * guide:  half-filled circle (left half solid)
 * origin: circle outline with center dot
 */
export default function TabIcon({ name, color, size = 22 }: TabIconProps) {
  switch (name) {
    case "today":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={7} fill={color} />
        </Svg>
      );

    case "notes":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x={10}
            y={4}
            width={4}
            height={16}
            rx={2}
            fill={color}
            rotation="-22"
            origin="12, 12"
          />
        </Svg>
      );

    case "guide":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <ClipPath id="leftHalf">
              <Rect x={0} y={0} width={12} height={24} />
            </ClipPath>
          </Defs>
          {/* Full circle outline */}
          <Circle
            cx={12}
            cy={12}
            r={6.5}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
          {/* Left half fill */}
          <G clipPath="url(#leftHalf)">
            <Circle cx={12} cy={12} r={7} fill={color} />
          </G>
        </Svg>
      );

    case "origin":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Outer ring */}
          <Circle
            cx={12}
            cy={12}
            r={6.5}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
          {/* Center dot */}
          <Circle cx={12} cy={12} r={1.8} fill={color} />
        </Svg>
      );

    default:
      return null;
  }
}
