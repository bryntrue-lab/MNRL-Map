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
  | "conditions"
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
  /** E1 — canonical ISO capture (`YYYY-MM-DD`), the format Human Design needs. */
  birthDateISO?: string | null;
  birthTime: string | null;
  birthLocation: { lat: number; lng: number; label: string } | null;
  /** E1 — free-text birth place, stored as typed (no geocoding in v1).
   *  Legacy after F1; new writes use birthPlaceParts. */
  birthPlace?: string | null;
  /** F1 — structured birth place: city as typed + ISO country from the
   *  static list. Deterministic enough to geocode server-side later. */
  birthPlaceParts?: { city: string; country: string; countryCode: string } | null;
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

  // Morning call mirror — mode + hour ONLY; coordinates never leave the
  // device. Additive; restored into device storage on sign-in.
  morningCall?: { mode: "sunrise" | "hour"; hour?: number } | null;
  // The permission moment fired once — mirrored so reinstalls never re-prompt.
  morningCallOffered?: boolean;

  // Server-written only — never set or modified by the client.
  // Security rules enforce their initial values on create and immutability on update.
  membershipStatus: MembershipStatus;
  membershipSince: Timestamp | null;
  membershipExpiresAt: Timestamp | null;
  membershipProductId: string | null;
  completedEncounterCount: number;

  // Slice L — server-controlled founder gate. Absent/false for everyone
  // unless set by an administrator; Firestore rules forbid client changes.
  readingsEnabled?: boolean;
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
  /**
   * The device's capture context. Optional because older notes intentionally
   * remain unbackfilled; the engine never derives either value from UTC.
   */
  localHour?: number;
  weekday?: number;

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
  // Task D: attribution material written by the engine (type · source · time)
  noteType?: FieldNoteType | null;
  encounterRef?: string | null;
};

export interface PatternDoc {
  patternType: PatternType;
  itemCounts: Record<string, number>;
  exemplars: Record<string, ExemplarEntry[]>;
  offerings: Record<string, { key: string; text: string }>;
  /** item → contributing note ids (D.3 note-set rules) */
  itemNotes?: Record<string, string[]>;
  /** processed-note ledger (read client-side only for self-heal checks) */
  processed?: string[];
  /** Primary/overflow evidence generation, when evidence pages are present. */
  evidenceGeneration?: number;
  evidenceSchemaVersion?: number;
  evidencePrimaryExemplarsPerItem?: number;
  evidencePageCount?: number;
  updatedAt: Timestamp;
  /** Slice K — conditions lens data (document id: `conditions`). */
  findings?: ConditionFinding[];
  detectedFindings?: ConditionFinding[];
  unsupportedFindingCount?: number;
  notesRead?: number;
  daysRead?: number;
  /** Slice K — consciousness lens data (document id: `consciousness`). */
  structureCounts?: Record<ConsciousnessStructure, number>;
  leading?: ConsciousnessStructure | null;
  exemplar?: ExemplarEntry | null;
}

export type ConsciousnessStructure = "magic" | "mythic" | "mental" | "integral";

export type ConditionFinding =
  | {
      kind: "hour";
      type: FieldNoteType;
      bucket: "morning" | "midday" | "evening" | "night";
      matchingCount: number;
      totalWithHour: number;
    }
  | {
      kind: "gap";
      type: FieldNoteType;
      matchingCount: number;
      totalQualifying: number;
    };

// ─────────────────────────────────────────────────────────────
// practitionerContent/{contentId}  (fully locked, admin/console only)
// ─────────────────────────────────────────────────────────────

export interface PractitionerContentDoc {
  key: string;
  keyType: "motif" | "resistance" | "condition";
  text: string;
  /** G2 — only approved passages are ever shown to a member. */
  passages?: FieldPassage[];
}

export type FieldPassageStatus = "approved" | "draft";
export type FieldPassageSource = "founder" | "generated";

export interface FieldPassage {
  text: string;
  locator: string | null;
  status: FieldPassageStatus;
  source: FieldPassageSource;
  createdAt: Timestamp;
}
