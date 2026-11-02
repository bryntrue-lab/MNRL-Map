import type { EncounterBlock, ReflectionPrompt } from "@/types/firestore";
import {
  beginSequenceEncounter,
  findCrystallizingNote,
  resolveAudioUrl,
  userEncounterId,
  type EncounterWithId,
} from "@/lib/firestore";

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

/**
 * Build a session from durable state — the one place that knows how to turn
 * (encounter, turn) into a playable session with its resume position.
 *
 * The module store above is a hand-off, not a record: it does not survive the
 * JS context being reclaimed while the app is backgrounded, nor any remount of
 * the encounter screen. Everything needed to reconstitute a session already
 * lives in Firestore (the userEncounters instance doc) and Storage, so the
 * screen can rebuild itself rather than dropping the practitioner back at the
 * tabs mid-practice.
 *
 * Safe to call again on an instance already in progress: beginSequenceEncounter
 * returns the existing doc with its ORIGINAL status, so a resume rebuilds as a
 * resume.
 */
export async function buildEncounterSession(
  uid: string,
  encounter: EncounterWithId,
  turn: number,
  opts: { visiting?: boolean } = {}
): Promise<EncounterSession> {
  // Resolve the Storage URL first — a missing file surfaces to the caller and
  // ends in the quiet return, never inside the held space (§11, §4).
  const audioUrl = await resolveAudioUrl(encounter.audioPath);

  let mode: EncounterMode = opts.visiting ? "visit" : "sequence";
  let resume: EncounterSession["resume"] = null;

  if (!opts.visiting) {
    const existing = await beginSequenceEncounter(uid, encounter.id, turn);
    if (existing?.status === "completed") {
      // The door already closed this turn — entering again is a visit: full
      // flow, no completion writes (§2).
      mode = "visit";
    } else if (existing?.status === "in-progress") {
      // Only a genuine mid-flow doc resumes; a visited→in-progress upgrade
      // starts fresh (its old positions belong to the visit).
      const blockIndex = existing.blockIndex ?? 0;
      const audioPosition = existing.audioPosition ?? 0;
      let crystallizing: { content: string | null } | null = null;
      if (blockIndex === 0) {
        // Capture already kept but no block reached → resume lands on the
        // counterweight, not a second ⟡ (§4 resume rules).
        const note = await findCrystallizingNote(
          uid,
          userEncounterId(encounter.id, turn)
        );
        if (note) crystallizing = { content: note.content ?? null };
      }
      if (blockIndex > 0 || audioPosition > 0 || crystallizing) {
        resume = { audioPosition, blockIndex, crystallizing };
      }
    }
  }

  return { encounter, turn, mode, audioUrl, resume };
}

/** Route params carrying the durable identity of an encounter screen. */
export function encounterRouteParams(s: EncounterSession) {
  return { e: s.encounter.id, t: String(s.turn), m: s.mode };
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

/** §5 — the reflection block's other prompts, collapsed behind
 *  `NEED A WAY IN? ↓` on the ⟡ screen. Never listed openly. */
export function warmUpPrompts(
  blocks: EncounterBlock[] | undefined
): ReflectionPrompt[] {
  for (const b of blocks ?? []) {
    if (b.type !== "reflection") continue;
    return b.prompts.filter((p) => !p.crystallizing);
  }
  return [];
}

/** Blocks rendered after the ⟡ capture — everything past the reflection block. */
export function postCaptureBlocks(
  blocks: EncounterBlock[] | undefined
): EncounterBlock[] {
  const all = blocks ?? [];
  const reflectionIdx = all.findIndex((b) => b.type === "reflection");
  return all.filter((_, i) => i !== (reflectionIdx === -1 ? -2 : reflectionIdx));
}

/** F3 — does this block resolve to visible content? A screen exists only
 *  if its block has content; anything else is skipped, never blank. */
function blockHasContent(b: EncounterBlock): boolean {
  switch (b.type) {
    case "integration":
      return typeof b.instruction === "string" && b.instruction.trim().length > 0;
    case "reflection":
      return (b.prompts ?? []).some((p) => (p.text ?? "").trim().length > 0);
    default:
      // carry (dropped since E5) and any unknown future type: no screen.
      return false;
  }
}

export interface SkippedBlock {
  index: number; // index within the encounter's original blocks array
  type: string;
}

/** F3 — the flow's screen list, generated from the encounter's block
 *  array: post-⟡ blocks that actually have content. Empty ones are
 *  returned in `skipped` so bad content is caught, not silently
 *  swallowed. */
export function renderablePostBlocks(blocks: EncounterBlock[] | undefined): {
  blocks: EncounterBlock[];
  skipped: SkippedBlock[];
} {
  const all = blocks ?? [];
  const post = postCaptureBlocks(all);
  const kept: EncounterBlock[] = [];
  const skipped: SkippedBlock[] = [];
  for (const b of post) {
    if (b.type !== "carry" && blockHasContent(b)) kept.push(b);
    else if (b.type !== "carry") skipped.push({ index: all.indexOf(b), type: b.type });
  }
  return { blocks: kept, skipped };
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
