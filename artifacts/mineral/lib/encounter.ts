import type { EncounterBlock, ReflectionPrompt } from "@/types/firestore";
import type { EncounterWithId } from "@/lib/firestore";

// ─────────────────────────────────────────────────────────────
// Encounter session — hand-off between the Threshold and the
// flow screen. Module store, same pattern as visitStore: set
// before navigating, consumed once on arrival.
// ─────────────────────────────────────────────────────────────

export type EncounterMode = "sequence" | "visit";

export interface EncounterSession {
  encounter: EncounterWithId;
  /** Practice turn keying the userEncounters instance doc. */
  turn: number;
  mode: EncounterMode;
  /** Resolved Storage download URL, ready for the player. */
  audioUrl: string;
  /** Existing instance state, when the doc predates this entry. */
  resume: {
    audioPosition: number;
    blockIndex: number;
    /** ⟡ note already kept this instance → resume past the capture. */
    crystallizing: { content: string | null } | null;
  } | null;
}

let session: EncounterSession | null = null;

export function setEncounterSession(s: EncounterSession): void {
  session = s;
}

export function consumeEncounterSession(): EncounterSession | null {
  const s = session;
  session = null;
  return s;
}

// ─────────────────────────────────────────────────────────────
// The beautiful hold (§1d) — transcription wait ceiling. At this
// point the ritual completes regardless; the transcript arrives
// later on its own.
// ─────────────────────────────────────────────────────────────

export const HOLD_TIMEOUT_MS = 60_000;

// Held silence after the audio completes, before the ⟡ screen (§1b).
export const HELD_SILENCE_MS = 1_500;

// ─────────────────────────────────────────────────────────────
// Block helpers
// ─────────────────────────────────────────────────────────────

/** The ⟡ prompt — the crystallizing prompt inside the reflection block. */
export function crystallizingPrompt(
  blocks: EncounterBlock[] | undefined
): ReflectionPrompt | null {
  for (const b of blocks ?? []) {
    if (b.type !== "reflection") continue;
    const hit = b.prompts.find((p) => p.crystallizing) ?? null;
    if (hit) return hit;
  }
  return null;
}

/** Blocks rendered after the ⟡ capture — everything past the reflection block. */
export function postCaptureBlocks(
  blocks: EncounterBlock[] | undefined
): EncounterBlock[] {
  const all = blocks ?? [];
  const reflectionIdx = all.findIndex((b) => b.type === "reflection");
  return all.filter((_, i) => i !== (reflectionIdx === -1 ? -2 : reflectionIdx));
}

// ─────────────────────────────────────────────────────────────
// Woven-line rule (§1e, v1, client-side):
//   the first sentence of 4–12 words; if none, the first 8 words
//   + ellipsis; if no content at all, the ⟡ prompt itself.
// ─────────────────────────────────────────────────────────────

export function wovenLine(
  content: string | null | undefined,
  fallback: string
): string {
  const text = (content ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;

  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  for (const raw of sentences) {
    const s = raw.trim();
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length >= 4 && words.length <= 12) return s;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const head = words.slice(0, 8).join(" ");
  return words.length > 8 ? `${head} …` : head;
}
