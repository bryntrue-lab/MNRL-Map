/**
 * The mathematical spine of the Origin map — Task A §5.
 *
 * Two clocks coexist and must never be wired together:
 *   • Life position — from the birth date via resolve(age). 28 years per turn,
 *     7-year quarters, the spiral turning inward toward the still point.
 *   • Practice position — from users.sequenceDay via encounterFor(day).
 *     108-day turns of four 27-day phases.
 *
 * Never derive the encounter from resolve(). Never derive the map reading
 * from sequenceDay.
 */

import type { PhaseId } from "@/types/firestore";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const MS_YEAR = 365.2425 * 24 * 3600 * 1000;
export const YEARS_PER_TURN = 28;
export const MAX_AGE = 84; // three turns on the map

export type Quarter = "east" | "south" | "west" | "north";

/** Quarter order by index floor(yearOfTurn / 7) — named by the station approached. */
export const QUARTERS: Quarter[] = ["east", "south", "west", "north"];

export interface StationDef {
  name: string;       // serif italic display — "Re-membering"
  label: string;      // caps map label — "RE-MEMBERING"
  structure: string;  // caps subscript — "INTEGRAL"
  color: string;      // map color (Origin palette, NOT the phase accents)
}

/** The four stations (§2) — map labels: name over structure subscript. */
export const STATION: Record<Quarter, StationDef> = {
  north: { name: "Re-membering", label: "RE-MEMBERING", structure: "INTEGRAL", color: "#e0568f" },
  east:  { name: "Unitive",      label: "UNITIVE",      structure: "MAGIC",    color: "#46d3a0" },
  south: { name: "Polarity",     label: "POLARITY",     structure: "MYTHIC",   color: "#e0a53a" },
  west:  { name: "Duality",      label: "DUALITY",      structure: "MENTAL",   color: "#7f9fe0" },
};

export const PHASE_BY_QUARTER: Record<Quarter, PhaseId> = {
  east: "field",
  south: "friction",
  west: "voice",
  north: "signal",
};

/** Practice-phase accents (encounter surfaces & the turn wheel — never the map). */
export const PHASE_ACCENT: Record<PhaseId, string> = {
  signal: "#C44A8A",
  field: "#5DCAA5",
  friction: "#D89A3A",
  voice: "#6B8EB8",
};

export const SEASON_MODE: Record<PhaseId, string> = {
  signal: "a season of arrival",
  field: "a season of gathering",
  friction: "a season of reckoning",
  voice: "a season of articulation",
};

/** Keyed to the counterweight position's OWN phase (opposite the current one). */
export const COUNTERWEIGHT_QUESTION: Record<PhaseId, string> = {
  signal: "What was arriving then that this season is answering?",
  field: "What was gathering then that you are now speaking?",
  friction: "What were you up against then that has since become material?",
  voice: "What were you saying then that this season is gathering toward?",
};

/**
 * Future-tense counterweight questions (§1b / C.1 §8) — used when the
 * counterweight's calendar date is AFTER the device's today. Keyed to the
 * counterweight position's OWN phase.
 */
export const COUNTERWEIGHT_QUESTION_FUTURE: Record<PhaseId, string> = {
  signal: "What will be arriving then that today is already preparing?",
  field: "What gathers now that you will be speaking then?",
  friction: "What are you up against now that will have become material by then?",
  voice: "What are you saying now that then will gather toward?",
};

export interface Season {
  title: string;
  question: string;
}

/** DRAFT strings — founder may replace without structural change. Turn ≥ 4 → mode line only. */
export const SEASONS: Record<number, Record<Quarter, Season>> = {
  1: {
    east:  { title: "The First Weather",      question: "What weather were you made in?" },
    south: { title: "The Edges of the World", question: "What did you learn where the world pushed back?" },
    west:  { title: "The Borrowed Tongue",    question: "Whose words did you speak before your own arrived?" },
    north: { title: "The Door Appears",       question: "What called before you knew its name?" },
  },
  2: {
    east:  { title: "The Chosen Ground",      question: "What grows in the ground you chose?" },
    south: { title: "What the Fire Keeps",    question: "What survives the burning?" },
    west:  { title: "The Many Rooms",         question: "What stays true when someone else is in the room?" },
    north: { title: "The Seed Remembers",     question: "What asks to be gathered home?" },
  },
  3: {
    east:  { title: "Becoming the Weather",   question: "What flourishes simply because you are near?" },
    south: { title: "What the Fire Finishes", question: "What is the long fire finishing in you?" },
    west:  { title: "The Telling",            question: "What is ready to be handed on?" },
    north: { title: "The Open Door",          question: "What was the calling, all along?" },
  },
};

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four",
  "twenty-five", "twenty-six", "twenty-seven", "twenty-eight",
];

/** Numbers as words ("turn two · year twenty-three"). Falls back to digits past 28. */
export function word(n: number): string {
  return WORDS[n] ?? String(n);
}

// ─────────────────────────────────────────────────────────────
// The life clock — resolve(age)
// ─────────────────────────────────────────────────────────────

export interface Resolved {
  age: number;
  turn: number;      // 1-indexed; turn one is the outermost arc
  yot: number;       // year of turn, 0 ≤ yot < 28 (fractional)
  quarter: Quarter;  // the station being approached
  phase: PhaseId;
  station: StationDef;
  bearing: number;   // radians clockwise from north
}

export function resolve(age: number): Resolved {
  const turn = Math.floor(age / YEARS_PER_TURN) + 1;
  const yot = age % YEARS_PER_TURN;
  const qi = Math.min(3, Math.floor(yot / 7));
  const quarter = QUARTERS[qi];
  return {
    age,
    turn,
    yot,
    quarter,
    phase: PHASE_BY_QUARTER[quarter],
    station: STATION[quarter],
    bearing: (yot / YEARS_PER_TURN) * 2 * Math.PI,
  };
}

/** Season for a resolved position; null when turn ≥ 4 (fall back to the mode line). */
export function seasonFor(r: Resolved): Season | null {
  return SEASONS[r.turn]?.[r.quarter] ?? null;
}

// ─────────────────────────────────────────────────────────────
// The practice clock — encounterFor(sequenceDay)
// ─────────────────────────────────────────────────────────────

const PHASES: PhaseId[] = ["signal", "field", "friction", "voice"];

/** 1-indexed practice turn for a sequence day (109 → turn 2). */
export function practiceTurnOf(sequenceDay: number): number {
  return Math.floor((sequenceDay - 1) / 108) + 1;
}

/** 1..108 position within the current practice turn. */
export function dayInTurn(sequenceDay: number): number {
  return ((sequenceDay - 1) % 108) + 1;
}

/**
 * Map a sequence day to its encounter coordinates.
 * SUPERSEDES the v1.6 §7 completed-set scan.
 */
export function encounterFor(sequenceDay: number): { phase: PhaseId; order: number } {
  const d = dayInTurn(sequenceDay);
  const phase = PHASES[Math.floor((d - 1) / 27)];
  const order = ((d - 1) % 27) + 1;
  return { phase, order };
}

/** Phase governing a 1..108 day of the wheel. */
export function phaseOfDay(d: number): PhaseId {
  return PHASES[Math.min(3, Math.floor((d - 1) / 27))];
}

// ─────────────────────────────────────────────────────────────
// Geometry — the inward spiral (viewBox 340 × 560)
// ─────────────────────────────────────────────────────────────

export const MAP_W = 340;
export const MAP_H = 560;
export const CX = 170;
export const CY = 288;
export const R0 = 141;   // radius at birth (outer edge)
export const K = 1.2;    // inward drift per year

export function radiusAt(age: number): number {
  return R0 - K * age;
}

export interface MapPoint {
  x: number;
  y: number;
  r: number;
  th: number;
}

export function pt(age: number): MapPoint {
  const th = ((age % YEARS_PER_TURN) / YEARS_PER_TURN) * 2 * Math.PI;
  const r = radiusAt(age);
  return { x: CX + r * Math.sin(th), y: CY - r * Math.cos(th), r, th };
}

/** Polyline path between two ages, sampled every 0.08y. */
export function spiralPath(a0: number, a1: number): string {
  let d = "";
  for (let a = a0; a <= a1 + 1e-9; a += 0.08) {
    const p = pt(Math.min(a, a1));
    d += (d ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
  }
  return d;
}

/** Numeric length of the sampled spiral polyline (native SVG has no getTotalLength). */
export function spiralLength(a0: number, a1: number): number {
  let len = 0;
  let prev = pt(a0);
  for (let a = a0 + 0.08; a <= a1 + 1e-9; a += 0.08) {
    const p = pt(Math.min(a, a1));
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  const last = pt(a1);
  len += Math.hypot(last.x - prev.x, last.y - prev.y);
  return len;
}

/** Nearest age on the spiral to a pointer position (viewBox coords). */
export function ageFromPointer(x: number, y: number, maxAge = MAX_AGE): number {
  let th = Math.atan2(x - CX, CY - y);
  if (th < 0) th += 2 * Math.PI;
  const yot = (th / (2 * Math.PI)) * YEARS_PER_TURN;
  const dist = Math.hypot(x - CX, y - CY);
  let best = yot;
  let bestD = Infinity;
  for (let t = 0; t < 3; t++) {
    const a = yot + t * YEARS_PER_TURN;
    if (a > maxAge) break;
    const d = Math.abs(radiusAt(a) - dist);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return Math.max(0.2, Math.min(maxAge - 0.2, best));
}

// ─────────────────────────────────────────────────────────────
// Turn wheel geometry — 108 dots, day 1 at north, clockwise (§9)
// ─────────────────────────────────────────────────────────────

export const PCX = 170;
export const PCY = 290;
export const PR = 128;

/** Wheel day nearest a pointer position (viewBox coords), or null off-ring. */
export function wheelDayFromPoint(x: number, y: number): number | null {
  const dx = x - PCX;
  const dy = y - PCY;
  const dist = Math.hypot(dx, dy);
  if (dist < PR - 30 || dist > PR + 30) return null;
  let th = Math.atan2(dx, -dy);
  if (th < 0) th += 2 * Math.PI;
  const d = Math.round((th / (2 * Math.PI)) * 108 + 1);
  return ((d - 1) % 108) + 1;
}

// ─────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────

export function ageAt(birth: Date, now: Date): number {
  return (now.getTime() - birth.getTime()) / MS_YEAR;
}

export function dateAtAge(birth: Date, age: number): Date {
  return new Date(birth.getTime() + age * MS_YEAR);
}

/** "April 2012" */
export function monthYearLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** The full ritual date — "Saturday, July 21, 2012". */
export function ritualDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Calendar-exact year shift: same month/day, Feb 29 clamped to Feb 28. */
export function shiftCalendarYears(d: Date, deltaYears: number): Date {
  const y = d.getFullYear() + deltaYears;
  const m = d.getMonth();
  const day = d.getDate();
  const shifted = new Date(y, m, day, 12);
  if (shifted.getMonth() !== m) return new Date(y, m, day - 1, 12); // Feb 29 → Feb 28
  return shifted;
}

/**
 * The counterweight's calendar date for a displayed position.
 * When the displayed position is today, the date must be calendar-exact:
 * today's month/day, 14 years back.
 */
export function counterweightDate(
  birth: Date,
  now: Date,
  displayAge: number,
  currentAge: number
): Date {
  if (Math.abs(displayAge - currentAge) < 0.01) return shiftCalendarYears(now, -14);
  return dateAtAge(birth, displayAge - 14);
}

// ─────────────────────────────────────────────────────────────
// Companions on the chord
// ─────────────────────────────────────────────────────────────

export interface Companion {
  key: "echo" | "horizon" | "ballast" | "answer";
  name: string;
  desc: string;
  age: number;
}

/** Missing companions are omitted, never greyed. Descriptors verbatim (§5). */
export function companionsFor(age: number): Companion[] {
  const defs: Companion[] = [
    { key: "echo",    name: "THE ECHO",    desc: "the same season, one cycle behind", age: age - 28 },
    { key: "horizon", name: "THE HORIZON", desc: "the same season, one cycle ahead",  age: age + 28 },
    { key: "ballast", name: "THE BALLAST", desc: "what was gathering then, lived",    age: age - 14 },
    { key: "answer",  name: "THE ANSWER",  desc: "the counterweight still to come",   age: age + 14 },
  ];
  return defs.filter((c) => c.age >= 0 && c.age <= MAX_AGE);
}
