import { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// SHARED ENUMS
// ─────────────────────────────────────────────────────────────

export type PhaseId = "signal" | "field" | "friction" | "voice";

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

export type PatternType =
  | "motif"
  | "thread"
  | "resistance"
  | "condition"
  | "consciousness";

export type MembershipStatus = "free" | "member";

// v1.7: 'visited' — an out-of-sequence visit honored without disturbing the sequence.
export type EncounterStatus = "saved" | "in-progress" | "completed" | "visited";

export type CaptureMode = "audio" | "text";

export type TranscriptStatus = "none" | "pending" | "done" | "failed";

export type NoteSource = "spontaneous" | "encounter";

// ─────────────────────────────────────────────────────────────
// users/{uid}
// ─────────────────────────────────────────────────────────────

export interface UserDoc {
  email: string;
  birthDate: Timestamp | null;
  birthTime: string | null;
  birthLocation: { lat: number; lng: number; label: string } | null;
  humanDesignType: string | null;
  currentPhase: PhaseId;
  currentTurn: number;
  journeyStartedAt: Timestamp;
  createdAt: Timestamp;

  // v1.7 — 1-indexed pointer into the 108-day practice; starts at 1.
  // Client-writable (not one of the five guarded fields).
  sequenceDay: number;

  // Task C §2 — the "keep this." moment fired once; never re-shown.
  // Client-writable, additive (absent on older docs).
  keepThisOffered?: boolean;
  /** Slice 5 — set at onboarding's terminal step (begin / save for later). */
  onboarded?: boolean;

  // Server-written only — never set or modified by the client.
  // Security rules enforce their initial values on create and immutability on update.
  membershipStatus: MembershipStatus;
  membershipSince: Timestamp | null;
  membershipExpiresAt: Timestamp | null;
  membershipProductId: string | null;
  completedEncounterCount: number;
}

// ─────────────────────────────────────────────────────────────
// encounters/{encounterId}  (global content library)
// ─────────────────────────────────────────────────────────────

// ── Encounter blocks — one screen per block inside the flow ──
// The seeded shape: reflection (holds the ⟡ crystallizing prompt),
// integration, carry. `options` exists in the v1.6 schema but no seeded
// encounter uses it yet.

export interface ReflectionPrompt {
  id: string;
  text: string;
  subtext?: string;
  capturable?: boolean;
  crystallizing?: boolean;
}

export type EncounterBlock =
  | { type: "reflection"; intro?: string; prompts: ReflectionPrompt[] }
  | {
      type: "integration";
      title?: string;
      instruction: string;
      durationLabel?: string;
      options?: string[];
    }
  | { type: "carry"; intro?: string; closing: string };

export interface EncounterDoc {
  title: string;
  subtitle: string;
  audioPath: string;
  phase: PhaseId;
  order: number;
  minTurn: number;
  blocks: EncounterBlock[];

  // Legacy v1.6 fields — absent on the current seed; kept optional for
  // forward compatibility with older documents.
  reflectionQuestions?: { id: string; text: string }[];
  integrationPractice?: string;
  fieldOfferings?: { key: string; text: string }[];

  guideNote?: string | null;
  deepDive?: unknown | null;
  nextThread?: string | null;

  // v1.7: one-line phrase shown on the map the day this encounter is today;
  // falls back to subtitle when null.
  mapEpigraph: string | null;
}

// ─────────────────────────────────────────────────────────────
// users/{uid}/userEncounters/{userEncounterId}
// Suggested doc id: `${encounterId}_t${turn}`
// ─────────────────────────────────────────────────────────────

export interface UserEncounterDoc {
  encounterId: string;
  turn: number;
  status: EncounterStatus;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;

  // v1.7 — first out-of-sequence visit; distinct from startedAt.
  visitedAt: Timestamp | null;
  // v1.7 — seconds into audio, for resume (Milestone B writes this).
  audioPosition: number;
  // v1.7 — block-screen index, for resume (Milestone B writes this).
  blockIndex: number;
}

// ─────────────────────────────────────────────────────────────
// users/{uid}/fieldNotes/{fieldNoteId}
// ─────────────────────────────────────────────────────────────

export interface FieldNoteDoc {
  type: FieldNoteType;
  captureMode: CaptureMode;
  audioPath: string | null;
  content: string | null;
  transcriptStatus: TranscriptStatus;

  // Engine-only — always null in v1. Client must NEVER write this field.
  // Security rules enforce absence on create (!('charge' in data)) and
  // immutability on update. createFieldNote omits it entirely, never writes null.
  charge: number | null;

  source: NoteSource;
  encounterRef: string | null;
  questionId: string | null;
  atmosphere: PhaseId;
  createdAt: Timestamp;

  // v1.8 additive — set only on counterweight "keep what comes" captures:
  // which map position provoked this reflection. Null on all other notes.
  mapRef?: { date: string; phase: PhaseId } | null;
}

// ─────────────────────────────────────────────────────────────
// users/{uid}/patterns/{patternType}  (doc id == patternType)
// Engine-written only; client reads only.
// ─────────────────────────────────────────────────────────────

export type ExemplarEntry = {
  text: string;
  fieldNoteId: string;
  source: string;
  capturedAt: Timestamp;
};

export interface PatternDoc {
  patternType: PatternType;
  itemCounts: Record<string, number>;
  exemplars: Record<string, ExemplarEntry[]>;
  offerings: Record<string, { key: string; text: string }>;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// practitionerContent/{contentId}  (fully locked, admin/console only)
// ─────────────────────────────────────────────────────────────

export interface PractitionerContentDoc {
  key: string;
  keyType: "motif" | "resistance" | "condition";
  text: string;
}
