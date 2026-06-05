import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { FontFamily } from "@/constants/typography";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type PhaseId = "signal" | "field" | "friction" | "voice";
export type TurnLabel = "first" | "second" | "third" | "fourth" | "fifth";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<PhaseId, string> = {
  signal:   "#c44a8a",
  field:    "#5dcaa5",
  friction: "#d89a3a",
  voice:    "#6b8eb8",
};

const PHASE_NAMES: Record<PhaseId, string> = {
  signal:   "The Signal",
  field:    "The Field",
  friction: "The Friction",
  voice:    "The Voice",
};

const CARDINAL_POSITIONS: Record<PhaseId, { cx: number; cy: number }> = {
  signal:   { cx: 60,  cy: 12  },
  field:    { cx: 108, cy: 60  },
  friction: { cx: 60,  cy: 108 },
  voice:    { cx: 12,  cy: 60  },
};

const TRAVELED_PATHS: Record<PhaseId, string | null> = {
  signal:   null,
  field:    "M 60 12 A 48 48 0 0 1 108 60",
  friction: "M 60 12 A 48 48 0 0 1 108 60 A 48 48 0 0 1 60 108",
  voice:    "M 60 12 A 48 48 0 0 1 108 60 A 48 48 0 0 1 60 108 A 48 48 0 0 1 12 60",
};

const DIM_COLORS: Record<PhaseId, string> = {
  signal:   "rgba(196,74,138,0.35)",
  field:    "rgba(93,202,165,0.35)",
  friction: "rgba(216,154,58,0.35)",
  voice:    "rgba(107,142,184,0.35)",
};

// ─────────────────────────────────────────────────────────────
// SPIRAL INDICATOR — Today screen compass
// ─────────────────────────────────────────────────────────────

interface SpiralIndicatorProps {
  phase?: PhaseId;
  turn?: TurnLabel;
  size?: number;
}

export function SpiralIndicator({
  phase = "signal",
  turn = "first",
  size = 88,
}: SpiralIndicatorProps) {
  const color    = PHASE_COLORS[phase];
  const name     = PHASE_NAMES[phase];
  const pos      = CARDINAL_POSITIONS[phase];
  const traveled = TRAVELED_PATHS[phase];

  return (
    <View style={spiralStyles.container}>
      <Svg viewBox="0 0 120 120" width={size} height={size}>
        <Circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        {traveled && (
          <Path d={traveled} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
        )}

        {(Object.entries(CARDINAL_POSITIONS) as [PhaseId, { cx: number; cy: number }][]).map(
          ([p, { cx, cy }]) =>
            p !== phase ? (
              <Circle key={p} cx={cx} cy={cy} r={2} fill={DIM_COLORS[p]} />
            ) : null
        )}

        <Circle cx={pos.cx} cy={pos.cy} r="5"  fill={color} />
        <Circle cx={pos.cx} cy={pos.cy} r="9"  fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <Circle cx={pos.cx} cy={pos.cy} r="13" fill="none" stroke={color} strokeWidth="0.5" opacity="0.25" />

        <Circle cx="60" cy="60" r="6"   fill="none" stroke="rgba(168,156,220,0.3)" strokeWidth="0.5" />
        <Circle cx="60" cy="60" r="2.5" fill="rgba(168,156,220,0.7)" />
      </Svg>

      <View style={spiralStyles.label}>
        <Text style={[spiralStyles.phaseName, { color }]}>{name}</Text>
        <Text style={spiralStyles.turnLabel}>{turn} turn of the spiral</Text>
      </View>
    </View>
  );
}

const spiralStyles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 22 },
  label: { alignItems: "center", marginTop: 12 },
  phaseName: {
    fontFamily: FontFamily.sans500,
    fontSize: 13,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  turnLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },
});

// ─────────────────────────────────────────────────────────────
// ONBOARDING SPIRAL — larger version for onboarding wheel screen
// Always shows Phase I (The Signal) active at North
// ─────────────────────────────────────────────────────────────

export function OnboardingSpiral() {
  return (
    <Svg viewBox="0 0 160 160" width={160} height={160}>
      <Circle cx="80" cy="80" r="64" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

      {/* North — Phase I · ACTIVE */}
      <Circle cx="80" cy="16" r="4"  fill="#c44a8a" />
      <Circle cx="80" cy="16" r="9"  fill="none" stroke="#c44a8a" strokeWidth="0.5" opacity="0.5" />
      <Circle cx="80" cy="16" r="14" fill="none" stroke="#c44a8a" strokeWidth="0.5" opacity="0.25" />

      {/* East — Phase II dim */}
      <Circle cx="144" cy="80" r="2" fill="rgba(93,202,165,0.45)" />
      {/* South — Phase III dim */}
      <Circle cx="80" cy="144" r="2" fill="rgba(216,154,58,0.45)" />
      {/* West — Phase IV dim */}
      <Circle cx="16" cy="80" r="2" fill="rgba(107,142,184,0.45)" />

      {/* Still point center */}
      <Circle cx="80" cy="80" r="6"  fill="none" stroke="rgba(168,156,220,0.3)" strokeWidth="0.5" />
      <Circle cx="80" cy="80" r="3"  fill="rgba(168,156,220,0.6)" />

      <SvgText
        x="80" y="9"
        textAnchor="middle"
        fill="#c44a8a"
        fontSize="6"
        letterSpacing="1.5"
        fontFamily="sans-serif"
      >
        PHASE I
      </SvgText>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// LIFE MAP SPIRAL — 28-year wheel for the Origin screen
// ─────────────────────────────────────────────────────────────

interface LifeMapSpiralProps {
  birthYear?: number;
  currentYear?: number;
  phase?: PhaseId;
}

export function LifeMapSpiral({
  birthYear = 1990,
  currentYear = 2026,
  phase = "signal",
}: LifeMapSpiralProps) {
  const yearsElapsed = currentYear - birthYear;
  const cycleNumber  = Math.floor(yearsElapsed / 28) + 1;
  const yearInCycle  = yearsElapsed % 28;
  const angleDeg     = (yearInCycle / 28) * 360 - 90;
  const angleRad     = (angleDeg * Math.PI) / 180;

  const outerR   = 92;
  const innerR   = 68;
  const currentR = cycleNumber === 1 ? outerR : innerR;

  const cx = 120 + currentR * Math.cos(angleRad);
  const cy = 120 + currentR * Math.sin(angleRad);

  const startX    = 120;
  const startY    = 120 - currentR;
  const largeArc  = yearInCycle > 14 ? 1 : 0;

  const traveledPath = yearInCycle > 0
    ? `M ${startX} ${startY} A ${currentR} ${currentR} 0 ${largeArc} 1 ${cx.toFixed(1)} ${cy.toFixed(1)}`
    : null;

  const cycle1Complete = cycleNumber > 1;
  const phaseColor = PHASE_COLORS[phase] ?? "#c44a8a";

  return (
    <Svg viewBox="0 0 240 240" width={220} height={220}>
      {/* Rings */}
      <Circle cx="120" cy="120" r={outerR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      <Circle cx="120" cy="120" r={innerR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

      {/* Cardinal arcs */}
      <Path d="M 120 28 A 92 92 0 0 1 212 120" fill="none" stroke="#5dcaa5" strokeWidth="1.2" opacity="0.35" />
      <Path d="M 212 120 A 92 92 0 0 1 120 212" fill="none" stroke="#d89a3a" strokeWidth="1.2" opacity="0.35" />
      <Path d="M 120 212 A 92 92 0 0 1 28 120"  fill="none" stroke="#6b8eb8" strokeWidth="1.2" opacity="0.35" />
      <Path d="M 28 120 A 92 92 0 0 1 120 28"   fill="none" stroke="#c44a8a" strokeWidth="1.2" opacity="0.35" />

      {/* Cardinal markers */}
      <Circle cx="120" cy="28"  r="3" fill="#c44a8a" />
      <Circle cx="212" cy="120" r="3" fill="#5dcaa5" />
      <Circle cx="120" cy="212" r="3" fill="#d89a3a" />
      <Circle cx="28"  cy="120" r="3" fill="#6b8eb8" />

      {/* Compass labels */}
      <SvgText x="120" y="14"  textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" letterSpacing="2" fontFamily="sans-serif">N</SvgText>
      <SvgText x="228" y="124" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" letterSpacing="2" fontFamily="sans-serif">E</SvgText>
      <SvgText x="120" y="232" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" letterSpacing="2" fontFamily="sans-serif">S</SvgText>
      <SvgText x="12"  y="124" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" letterSpacing="2" fontFamily="sans-serif">W</SvgText>

      {/* Birth year at north */}
      <SvgText x="120" y="6" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="5.5" fontFamily="sans-serif">
        {birthYear}
      </SvgText>

      {/* Completed cycle 1 full ring */}
      {cycle1Complete && (
        <Circle cx="120" cy="120" r={outerR} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />
      )}

      {/* Traveled arc */}
      {traveledPath && (
        <Path d={traveledPath} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
      )}

      {/* Current position — glowing dot */}
      <Circle cx={cx} cy={cy} r="5"  fill={phaseColor} />
      <Circle cx={cx} cy={cy} r="9"  fill="none" stroke={phaseColor} strokeWidth="0.5" opacity="0.55" />
      <Circle cx={cx} cy={cy} r="14" fill="none" stroke={phaseColor} strokeWidth="0.5" opacity="0.25" />

      {/* NOW label */}
      <SvgText
        x={cx + 12} y={cy + 4}
        textAnchor="start"
        fill="rgba(255,255,255,0.5)"
        fontSize="5.5"
        fontFamily="sans-serif"
        letterSpacing="1"
      >
        NOW
      </SvgText>

      {/* Still point center */}
      <Circle cx="120" cy="120" r="9" fill="rgba(168,156,220,0.06)" />
      <Circle cx="120" cy="120" r="4" fill="rgba(168,156,220,0.8)" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ORIGIN META — meta rows below the LifeMapSpiral on Origin screen
// ─────────────────────────────────────────────────────────────

interface OriginMetaProps {
  birthYear?: number;
  currentYear?: number;
  phase?: PhaseId;
  humanDesignType?: string | null;
}

const ORDINALS: TurnLabel[] = ["first", "second", "third", "fourth", "fifth"];

export function OriginMeta({
  birthYear,
  currentYear = 2026,
  phase = "signal",
  humanDesignType = null,
}: OriginMetaProps) {
  const yearsElapsed = birthYear ? currentYear - birthYear : 0;
  const cycleNumber  = Math.floor(yearsElapsed / 28) + 1;
  const yearInCycle  = yearsElapsed % 28;
  const cycleLabel   = ORDINALS[cycleNumber - 1] ?? `${cycleNumber}th`;

  const phaseColor = PHASE_COLORS[phase] ?? "#c44a8a";
  const phaseName  = PHASE_NAMES[phase]  ?? "The Signal";

  return (
    <View style={metaStyles.container}>
      {birthYear !== undefined && (
        <View style={metaStyles.row}>
          <Text style={metaStyles.key}>born</Text>
          <Text style={metaStyles.val}>{birthYear} · cycle {cycleLabel} began</Text>
        </View>
      )}
      <View style={metaStyles.row}>
        <Text style={metaStyles.key}>phase</Text>
        <Text style={[metaStyles.val, { color: phaseColor }]}>{phaseName}</Text>
      </View>
      <View style={metaStyles.row}>
        <Text style={metaStyles.key}>now</Text>
        <Text style={[metaStyles.val, { color: "#c4baea" }]}>
          year {yearInCycle} of cycle {cycleLabel}
        </Text>
      </View>
      <View style={metaStyles.row}>
        <Text style={metaStyles.key}>design</Text>
        <Text style={metaStyles.val}>
          {humanDesignType ?? "add your birth date →"}
        </Text>
      </View>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  container: {
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10,
    paddingHorizontal: 24,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  key: {
    fontFamily: FontFamily.sans500,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.3,
  },
  val: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
});
