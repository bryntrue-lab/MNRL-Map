import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { FontFamily } from "@/constants/typography";
import {
  CX,
  CY,
  MAP_H,
  MAP_W,
  MAX_AGE,
  PCX,
  PCY,
  PHASE_ACCENT,
  PR,
  QUARTERS,
  STATION,
  pt,
  phaseOfDay,
  resolve,
  spiralLength,
  spiralPath,
  type Quarter,
} from "@/lib/spiral";

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
// ORIGIN MAP — §6. The life spiral: three turns of 28 years,
// birth at the outer edge, the still point at the center (84).
// Pure renderer — the Origin screen owns every animated number
// and passes them in as `visual`. No radial gradients here: the
// still-point glow is layered circles (Atmosphere.tsx is the only
// file that may define them).
// ─────────────────────────────────────────────────────────────

export interface OriginMapVisual {
  /** Choreography cover — 1 fully dark → 0 clear. */
  blackout: number;
  /** Still point opacity. */
  still: number;
  /** Lived-line draw progress 0..1 (outside-in). */
  lived: number;
  /** Future line + hollow crossings opacity. */
  future: number;
  /** Needle draw progress 0..1 (center → NOW). */
  needle: number;
  /** NOW dot + counterweight line opacity. */
  nowOn: number;
  /** Station label opacities (wander raises, settle withdraws). */
  stationOpacity: Record<Quarter, number>;
  /** Crossing-year label opacity. */
  yearsOpacity: number;
  /** 1 normal · lowered while a sheet is open (arcs recede, needle stays). */
  arcsDim: number;
}

export const SETTLED_VISUAL: OriginMapVisual = {
  blackout: 0,
  still: 1,
  lived: 1,
  future: 1,
  needle: 1,
  nowOn: 1,
  stationOpacity: { north: 0, east: 0, south: 0, west: 0 },
  yearsOpacity: 0,
  arcsDim: 1,
};

interface StationLabelPos {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

// §2.1.1 — east/west x is computed from the screen-edge inset at render
// time (≥12pt on screen, never clipped); north/south stay fixed.
const STATION_LABEL_Y: Record<Quarter, number> = {
  north: 122,
  east: 283,
  south: 452,
  west: 283,
};

// ── §2.1.1 label collision geometry (viewBox units) ──────────
// Approximate text extents for sans caps at the sizes used below.
const STATION_FONT = 14;
const STATION_LS = 2;
const STRUCTURE_FONT = 11;
const STRUCTURE_LS = 1.6;
const YEAR_FONT = 12;

function textWidth(text: string, fontSize: number, letterSpacing: number): number {
  return text.length * fontSize * 0.62 + Math.max(0, text.length - 1) * letterSpacing;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxesIntersect(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function anchoredBox(
  x: number,
  baselineY: number,
  anchor: "start" | "middle" | "end",
  w: number,
  fontSize: number
): Box {
  const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { x0, y0: baselineY - fontSize, x1: x0 + w, y1: baselineY + 3 };
}

/** Station a 7-year crossing arrives at (age 7 → east, 14 → south, …). */
function crossingQuarter(age: number): Quarter {
  return QUARTERS[(age / 7 - 1) % 4];
}

interface OriginMapProps {
  /** null → placeholder: the still point alone (§7 no-birth-date state). */
  currentAge: number | null;
  /** Pendulum position — equals currentAge when settled. */
  displayAge: number;
  birthYear: number | null;
  visual: OriginMapVisual;
  width: number;
  height: number;
  /**
   * §2.1.1 — horizontal inset (viewBox units) that keeps east/west station
   * labels ≥12pt inside the SCREEN edge. Computed by the owner from the
   * zone geometry; defaults to a safe in-viewBox margin.
   */
  labelInsetVb?: number;
  /**
   * §2.1.1 — viewBox y of the wander caption's clearance zone. No label
   * (year or station) may render at or below this line. Infinity = off.
   */
  avoidYVb?: number;
}

export function OriginMap({
  currentAge,
  displayAge,
  birthYear,
  visual,
  width,
  height,
  labelInsetVb = 12,
  avoidYVb = Infinity,
}: OriginMapProps) {
  const clampedAge = currentAge == null ? null : Math.min(currentAge, MAX_AGE - 0.05);

  const livedGeom = useMemo(() => {
    if (clampedAge == null) return null;
    return {
      d: spiralPath(0, clampedAge),
      len: spiralLength(0, clampedAge),
    };
  }, [clampedAge]);

  const futureD = useMemo(() => {
    if (clampedAge == null || clampedAge >= MAX_AGE - 0.1) return null;
    return spiralPath(clampedAge, MAX_AGE);
  }, [clampedAge]);

  // §2.1.1 — east/west station labels hug the screen edge with a real
  // margin; y positions are fixed. Recomputed when the inset changes.
  const stationPos = useMemo<Record<Quarter, StationLabelPos>>(
    () => ({
      north: { x: CX, y: STATION_LABEL_Y.north, anchor: "middle" },
      east: { x: MAP_W - labelInsetVb, y: STATION_LABEL_Y.east, anchor: "end" },
      south: { x: CX, y: STATION_LABEL_Y.south, anchor: "middle" },
      west: { x: labelInsetVb, y: STATION_LABEL_Y.west, anchor: "start" },
    }),
    [labelInsetVb]
  );

  // Combined bounding box (name + structure subscript) per station label.
  const stationBoxes = useMemo<Record<Quarter, Box>>(() => {
    const boxes = {} as Record<Quarter, Box>;
    for (const q of QUARTERS) {
      const posn = stationPos[q];
      const s = STATION[q];
      const a = anchoredBox(
        posn.x,
        posn.y,
        posn.anchor,
        textWidth(s.label, STATION_FONT, STATION_LS),
        STATION_FONT
      );
      const b = anchoredBox(
        posn.x,
        posn.y + 15,
        posn.anchor,
        textWidth(s.structure, STRUCTURE_FONT, STRUCTURE_LS),
        STRUCTURE_FONT
      );
      boxes[q] = {
        x0: Math.min(a.x0, b.x0),
        y0: a.y0,
        x1: Math.max(a.x1, b.x1),
        y1: b.y1,
      };
    }
    return boxes;
  }, [stationPos]);

  const crossings = useMemo(() => {
    if (clampedAge == null) return [];
    const list: {
      age: number;
      x: number;
      y: number;
      lx: number;
      ly: number;
      q: Quarter;
      lived: boolean;
      labelVisible: boolean;
    }[] = [];
    const yearW = birthYear != null ? textWidth(String(birthYear + 7), YEAR_FONT, 0) : 30;
    for (let a = 7; a < MAX_AGE; a += 7) {
      const p = pt(a);
      const q = crossingQuarter(a);
      let lx: number;
      let ly: number;
      if (q === "east" || q === "west") {
        // §2.1.1 — years beside east/west stations sit BELOW their crossing
        // dots, clear of the station text at current sizes.
        lx = p.x;
        ly = p.y + 26; // clears the station text block (baseline 283 + subscript)
      } else {
        const out = p.r + 11;
        lx = CX + out * Math.sin(p.th);
        ly = CY - out * Math.cos(p.th) + 2;
      }
      // Never let a year run off the screen edge either.
      lx = Math.min(Math.max(lx, labelInsetVb + yearW / 2), MAP_W - labelInsetVb - yearW / 2);

      // §2.1.1 — where a year would still collide with a station label,
      // the year yields; and nothing renders inside the caption's zone.
      const yearBox = anchoredBox(lx, ly, "middle", yearW, YEAR_FONT);
      const hitStation = QUARTERS.some((sq) => boxesIntersect(yearBox, stationBoxes[sq]));
      const hitCaption = yearBox.y1 > avoidYVb;
      list.push({
        age: a,
        x: p.x,
        y: p.y,
        lx,
        ly,
        q,
        lived: a <= clampedAge,
        labelVisible: !hitStation && !hitCaption,
      });
    }
    return list;
  }, [clampedAge, birthYear, labelInsetVb, avoidYVb, stationBoxes]);

  const now = pt(Math.max(0.2, Math.min(displayAge, MAX_AGE - 0.2)));
  const nowStation = STATION[resolve(displayAge).quarter];
  const needleLen = Math.hypot(now.x - CX, now.y - CY);
  const cw = displayAge >= 14 ? pt(displayAge - 14) : null;

  const placeholder = clampedAge == null;

  return (
    <Svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={width} height={height}>
      {!placeholder && (
        <G opacity={visual.arcsDim}>
          {/* Future — barely there, hollow */}
          {futureD && (
            <Path
              d={futureD}
              fill="none"
              stroke="rgba(220,210,255,0.08)"
              strokeWidth={0.7}
              opacity={visual.future}
            />
          )}
          {crossings
            .filter((c) => !c.lived)
            .map((c) => (
              <Circle
                key={`f${c.age}`}
                cx={c.x}
                cy={c.y}
                r={1.8}
                fill="none"
                stroke="rgba(220,210,255,0.22)"
                strokeWidth={0.6}
                opacity={visual.future}
              />
            ))}

          {/* Lived — drawn outside-in during the choreography */}
          {livedGeom && (
            <Path
              d={livedGeom.d}
              fill="none"
              stroke="rgba(220,210,255,0.33)"
              strokeWidth={1}
              strokeDasharray={[livedGeom.len]}
              strokeDashoffset={livedGeom.len * (1 - visual.lived)}
            />
          )}
          {crossings
            .filter((c) => c.lived)
            .map((c) => (
              <Circle
                key={`l${c.age}`}
                cx={c.x}
                cy={c.y}
                r={2.4}
                fill={STATION[c.q].color}
                opacity={0.85 * (visual.lived >= (c.age / (clampedAge || 1)) ? 1 : 0)}
              />
            ))}

          {/* Crossing years — visible while wandering or during the draw */}
          <G opacity={visual.yearsOpacity}>
            {birthYear != null &&
              crossings
                .filter((c) => c.lived && c.labelVisible)
                .map((c) => (
                  <SvgText
                    key={`y${c.age}`}
                    x={c.lx}
                    y={c.ly}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.38)"
                    fontSize={12}
                    fontFamily="sans-serif"
                  >
                    {birthYear + c.age}
                  </SvgText>
                ))}
          </G>

          {/* Station labels — name over structure subscript.
              §2.1.1 — a label inside the caption's clearance zone yields. */}
          {QUARTERS.map((q) => {
            const posn = stationPos[q];
            const s = STATION[q];
            if (stationBoxes[q].y1 > avoidYVb) return null;
            return (
              <G key={q} opacity={visual.stationOpacity[q]}>
                <SvgText
                  x={posn.x}
                  y={posn.y}
                  textAnchor={posn.anchor}
                  fill={s.color}
                  fontSize={14}
                  letterSpacing={2}
                  fontFamily="sans-serif"
                  opacity={0.8}
                >
                  {s.label}
                </SvgText>
                <SvgText
                  x={posn.x}
                  y={posn.y + 15}
                  textAnchor={posn.anchor}
                  fill="rgba(255,255,255,0.32)"
                  fontSize={11}
                  letterSpacing={1.6}
                  fontFamily="sans-serif"
                >
                  {s.structure}
                </SvgText>
              </G>
            );
          })}
        </G>
      )}

      {/* Still point — the destination; carries the visual weight */}
      <G opacity={visual.still}>
        <Circle cx={CX} cy={CY} r={26} fill="rgba(200,190,225,0.05)" />
        <Circle cx={CX} cy={CY} r={15} fill="rgba(200,190,225,0.09)" />
        <Circle cx={CX} cy={CY} r={8} fill="rgba(210,200,235,0.16)" />
        <Circle cx={CX} cy={CY} r={3.2} fill="rgba(225,215,250,0.85)" />
      </G>

      {!placeholder && (
        <>
          {/* Counterweight line — dotted, center → 14 years back */}
          {cw && (
            <Line
              x1={CX}
              y1={CY}
              x2={cw.x}
              y2={cw.y}
              stroke="rgba(200,190,225,0.28)"
              strokeWidth={0.7}
              strokeDasharray={[2, 4]}
              opacity={visual.nowOn}
            />
          )}

          {/* Needle — center → NOW, luminous toward the outer end */}
          <Defs>
            <LinearGradient
              id="originNeedle"
              gradientUnits="userSpaceOnUse"
              x1={CX}
              y1={CY}
              x2={now.x}
              y2={now.y}
            >
              <Stop offset="0%" stopColor="#e6e1ff" stopOpacity="0" />
              <Stop offset="60%" stopColor="#e6e1ff" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#fff0ff" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
          <Line
            x1={CX}
            y1={CY}
            x2={now.x}
            y2={now.y}
            stroke="url(#originNeedle)"
            strokeWidth={1}
            strokeDasharray={[needleLen]}
            strokeDashoffset={needleLen * (1 - visual.needle)}
          />

          {/* NOW — in the color of the station being approached */}
          <Circle cx={now.x} cy={now.y} r={3} fill={nowStation.color} opacity={visual.nowOn} />
        </>
      )}

      {/* Choreography cover */}
      {visual.blackout > 0.003 && (
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#0a0812" opacity={visual.blackout} />
      )}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// TURN WHEEL — §9. The practice clock: 108 days, day 1 at north,
// clockwise. Dot grammar: walked days filled in their phase
// accent · today white with a halo · future barely-there hollow ·
// visited days carry a thin accent ring.
// ─────────────────────────────────────────────────────────────

interface TurnWheelProps {
  /** Today's 1..108 position within the turn. */
  today: number;
  visited: ReadonlySet<number>;
  width: number;
  height: number;
}

const PHASE_LABELS: { name: string; frac: number; phase: PhaseId }[] = [
  { name: "SIGNAL", frac: 0.125, phase: "signal" },
  { name: "FIELD", frac: 0.375, phase: "field" },
  { name: "FRICTION", frac: 0.625, phase: "friction" },
  { name: "VOICE", frac: 0.875, phase: "voice" },
];

export function TurnWheel({ today, visited, width, height }: TurnWheelProps) {
  const dots = useMemo(() => {
    const list: { d: number; x: number; y: number; accent: string }[] = [];
    for (let d = 1; d <= 108; d++) {
      const th = ((d - 1) / 108) * 2 * Math.PI;
      list.push({
        d,
        x: PCX + PR * Math.sin(th),
        y: PCY - PR * Math.cos(th),
        accent: PHASE_ACCENT[phaseOfDay(d)],
      });
    }
    return list;
  }, []);

  return (
    <Svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={width} height={height}>
      {PHASE_LABELS.map((p) => {
        const th = p.frac * 2 * Math.PI;
        const x = PCX + (PR + 26) * Math.sin(th);
        const y = PCY - (PR + 26) * Math.cos(th) + 2;
        return (
          <SvgText
            key={p.name}
            x={x}
            y={y}
            textAnchor="middle"
            fill={PHASE_ACCENT[p.phase]}
            opacity={0.55}
            fontSize={11}
            letterSpacing={2.4}
            fontFamily="sans-serif"
          >
            {p.name}
          </SvgText>
        );
      })}

      {dots.map((dot) => {
        if (dot.d === today) {
          return (
            <G key={dot.d}>
              <Circle cx={dot.x} cy={dot.y} r={3} fill="rgba(255,255,255,0.96)" />
              <Circle
                cx={dot.x}
                cy={dot.y}
                r={6.5}
                fill="none"
                stroke={dot.accent}
                strokeWidth={0.7}
                opacity={0.65}
              />
            </G>
          );
        }
        const isVisited = visited.has(dot.d);
        if (dot.d < today) {
          return (
            <G key={dot.d}>
              <Circle cx={dot.x} cy={dot.y} r={2} fill={dot.accent} opacity={0.75} />
              {isVisited && (
                <Circle
                  cx={dot.x}
                  cy={dot.y}
                  r={4.2}
                  fill="none"
                  stroke={dot.accent}
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              )}
            </G>
          );
        }
        return (
          <G key={dot.d}>
            <Circle
              cx={dot.x}
              cy={dot.y}
              r={1.4}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={0.5}
            />
            {isVisited && (
              <Circle
                cx={dot.x}
                cy={dot.y}
                r={4.2}
                fill="none"
                stroke={dot.accent}
                strokeWidth={0.5}
                opacity={0.4}
              />
            )}
          </G>
        );
      })}

      {/* The still point holds the center of this clock too */}
      <Circle cx={PCX} cy={PCY} r={12} fill="rgba(200,190,225,0.06)" />
      <Circle cx={PCX} cy={PCY} r={2.6} fill="rgba(225,215,250,0.7)" />
    </Svg>
  );
}
