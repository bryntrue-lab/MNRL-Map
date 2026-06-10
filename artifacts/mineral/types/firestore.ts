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

export type EncounterStatus = "saved" | "in-progress" | "completed";

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

export interface EncounterDoc {
  title: string;
  subtitle: string;
  audioPath: string;
  phase: PhaseId;
  order: number;
  minTurn: number;
  reflectionQuestions: { id: string; text: string }[];
  integrationPractice: string;
  fieldOfferings?: { key: string; text: string }[];
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
