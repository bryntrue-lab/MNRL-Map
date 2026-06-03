import React from "react";
import { Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export default function OnboardingAtmosphere() {
  return (
    <Svg
      width={width * 2}
      height={height * 0.75}
      style={{
        position: "absolute",
        top: 0,
        left: -(width * 0.5),
        pointerEvents: "none",
      }}
    >
      <Defs>
        <RadialGradient
          id="archaicGlow"
          cx="50%"
          cy="20%"
          rx="60%"
          ry="55%"
          fx="50%"
          fy="20%"
        >
          <Stop offset="0%"   stopColor="#3D1E3D" stopOpacity="0.85" />
          <Stop offset="35%"  stopColor="#2A1530" stopOpacity="0.6" />
          <Stop offset="65%"  stopColor="#1A0D1F" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#050208" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#archaicGlow)" />
    </Svg>
  );
}
