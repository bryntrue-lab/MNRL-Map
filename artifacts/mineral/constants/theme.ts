/**
 * Mineral theme constants beyond colors and typography.
 */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// The four phases of the spiral journey
export type Phase = "signal" | "field" | "friction" | "voice";

export const PhaseLabels: Record<Phase, string> = {
  signal: "Signal",
  field: "Field",
  friction: "Friction",
  voice: "Voice",
};

// Field note types allowed in v0.5
export type FieldNoteType =
  | "dream"
  | "spark"
  | "resistance"
  | "symbol"
  | "synchronicity"
  | "vision"
  | "desire"
  | "fear"
  | "other"
  | "reflection";

export type ContentType = "text" | "audio";
export type NoteSource = "spontaneous" | "from-encounter";
