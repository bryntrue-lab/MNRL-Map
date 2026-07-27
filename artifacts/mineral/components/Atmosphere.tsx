import React from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");

interface StopDef {
  offset: string;
  color: string;
  opacity: string;
}

interface PhaseAtmosphereProps {
  stops: StopDef[];
  gradientId: string;
}

function PhaseAtmosphere({ stops, gradientId }: PhaseAtmosphereProps) {
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
          id={gradientId}
          cx="50%"
          cy="20%"
          rx="60%"
          ry="55%"
          fx="50%"
          fy="20%"
        >
          {stops.map((stop, i) => (
            <Stop
              key={i}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

// Phase I — The Signal (archaic purple)
export function ArchaicAtmosphere() {
  return (
    <PhaseAtmosphere
      gradientId="archaicGlow"
      stops={[
        { offset: "0%",   color: "#3D1E3D", opacity: "0.85" },
        { offset: "35%",  color: "#2A1530", opacity: "0.6" },
        { offset: "65%",  color: "#1A0D1F", opacity: "0.25" },
        { offset: "100%", color: "#050208", opacity: "0" },
      ]}
    />
  );
}

// Phase II — The Field (green)
// TODO: finalize gradient values when Phase II is built
export function MagicalAtmosphere() {
  return (
    <PhaseAtmosphere
      gradientId="magicalGlow"
      stops={[
        { offset: "0%",   color: "#1E3D2A", opacity: "0.85" },
        { offset: "35%",  color: "#15302A", opacity: "0.6" },
        { offset: "65%",  color: "#0D1F1A", opacity: "0.25" },
        { offset: "100%", color: "#020805", opacity: "0" },
      ]}
    />
  );
}

// Phase III — The Friction (amber)
// TODO: finalize gradient values when Phase III is built
export function MythicalAtmosphere() {
  return (
    <PhaseAtmosphere
      gradientId="mythicalGlow"
      stops={[
        { offset: "0%",   color: "#3D2E1E", opacity: "0.85" },
        { offset: "35%",  color: "#302515", opacity: "0.6" },
        { offset: "65%",  color: "#1F170D", opacity: "0.25" },
        { offset: "100%", color: "#080502", opacity: "0" },
      ]}
    />
  );
}

// Phase IV — The Voice (blue)
// TODO: finalize gradient values when Phase IV is built
export function MentalAtmosphere() {
  return (
    <PhaseAtmosphere
      gradientId="mentalGlow"
      stops={[
        { offset: "0%",   color: "#1E2E3D", opacity: "0.85" },
        { offset: "35%",  color: "#152230", opacity: "0.6" },
        { offset: "65%",  color: "#0D161F", opacity: "0.25" },
        { offset: "100%", color: "#020508", opacity: "0" },
      ]}
    />
  );
}

// Phase V — The Next Turn (violet)
// TODO: finalize gradient values when Phase V is built
export function IntegralAtmosphere() {
  return (
    <PhaseAtmosphere
      gradientId="integralGlow"
      stops={[
        { offset: "0%",   color: "#2E1E3D", opacity: "0.85" },
        { offset: "35%",  color: "#221530", opacity: "0.6" },
        { offset: "65%",  color: "#160D1F", opacity: "0.25" },
        { offset: "100%", color: "#050208", opacity: "0" },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Origin tab — §2. Ground #0a0812, two soft glows (#241a38 / #141024),
// and a slow ~7s breath. Deliberately darker and stiller than the
// encounter atmospheres above.
// ─────────────────────────────────────────────────────────────

export function OriginAtmosphere() {
  const breath = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="originGlowA" cx="30%" cy="62%" rx="58%" ry="44%">
            <Stop offset="0%" stopColor="#241a38" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#241a38" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="originGlowB" cx="72%" cy="26%" rx="52%" ry="42%">
            <Stop offset="0%" stopColor="#141024" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#141024" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#originGlowA)" />
        <Rect width="100%" height="100%" fill="url(#originGlowB)" />
      </Svg>

      {/* The breath — a center glow swelling and settling on a ~7s cycle. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.9],
            }),
            transform: [
              {
                scale: breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              },
            ],
          },
        ]}
      >
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="originBreath" cx="50%" cy="46%" rx="46%" ry="36%">
              <Stop offset="0%" stopColor="#241a38" stopOpacity="0.32" />
              <Stop offset="100%" stopColor="#241a38" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#originBreath)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
