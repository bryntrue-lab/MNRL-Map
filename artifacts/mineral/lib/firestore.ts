import {
  FieldValue,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef } from "firebase/storage";

import { db, storage } from "@/lib/firebase";
import { encounterFor, practiceTurnOf } from "@/lib/spiral";
import type {
  CaptureMode,
  EncounterDoc,
  FieldNoteDoc,
  FieldNoteType,
  NoteSource,
  PhaseId,
  UserEncounterDoc,
} from "@/types/firestore";

// ─────────────────────────────────────────────────────────────
// §5 v1.7 — the practice clock selects the encounter.
// encounterFor(sequenceDay) SUPERSEDES the v1.6 completed-set scan.
// ─────────────────────────────────────────────────────────────

export type EncounterWithId = EncounterDoc & { id: string };

let libraryCache: EncounterWithId[] | null = null;

/** The whole library is seven small docs — fetch once, keep for the session. */
export async function fetchEncounterLibrary(): Promise<EncounterWithId[]> {
  if (libraryCache) return libraryCache;
  const snap = await getDocs(
    query(collection(db, "encounters"), orderBy("order", "asc"))
  );
  libraryCache = snap.docs.map((d) => ({ id: d.id, ...(d.data() as EncounterDoc) }));
  return libraryCache;
}

/** Pure selection: sequenceDay → (phase, order), minTurn honored. */
export function selectEncounterForDay(
  library: EncounterWithId[],
  sequenceDay: number,
  currentTurn: number
): EncounterWithId | null {
  const { phase, order } = encounterFor(sequenceDay);
  return (
    library.find(
      (e) => e.phase === phase && e.order === order && e.minTurn <= currentTurn
    ) ?? null
  );
}

const PHASE_ORDER: PhaseId[] = ["signal", "field", "friction", "voice"];

/** 1..108 wheel day an encounter occupies within a practice turn. */
export function dayOfEncounter(e: Pick<EncounterDoc, "phase" | "order">): number {
  return PHASE_ORDER.indexOf(e.phase) * 27 + e.order;
}

/** §11 — Begin resolves the Storage URL; failures surface to the caller. */
export async function resolveAudioUrl(audioPath: string): Promise<string> {
  return getDownloadURL(storageRef(storage, audioPath));
}

// ─────────────────────────────────────────────────────────────
// userEncounters — turn-scoped instance docs `${encounterId}_t${turn}`
// ─────────────────────────────────────────────────────────────

export function userEncounterId(encounterId: string, turn: number): string {
  return `${encounterId}_t${turn}`;
}

export async function getUserEncounter(
  uid: string,
  encounterId: string,
  turn: number
): Promise<UserEncounterDoc | null> {
  const snap = await getDoc(
    doc(db, "users", uid, "userEncounters", userEncounterId(encounterId, turn))
  );
  return snap.exists() ? (snap.data() as UserEncounterDoc) : null;
}

/**
 * §9 — an out-of-sequence visit records 'visited' + visitedAt, but must never
 * disturb a stronger status (in-progress / completed). Create-only.
 */
export async function recordVisit(
  uid: string,
  encounterId: string,
  turn: number
): Promise<void> {
  const ref = doc(db, "users", uid, "userEncounters", userEncounterId(encounterId, turn));
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const data: Omit<UserEncounterDoc, "visitedAt"> & { visitedAt: FieldValue } = {
    encounterId,
    turn,
    status: "visited",
    startedAt: null,
    completedAt: null,
    visitedAt: serverTimestamp(),
    audioPosition: 0,
    blockIndex: 0,
  };
  await setDoc(ref, data);
}

/** All instance docs for a practice turn — drives the turn wheel's dot grammar. */
export function turnEncountersQuery(uid: string, turn: number) {
  return query(
    collection(db, "users", uid, "userEncounters"),
    where("turn", "==", turn)
  );
}

/**
 * Keep users.currentPhase / currentTurn in sync with the sequenceDay pointer
 * when a phase or turn boundary is crossed (§5). Merge write; both fields are
 * client-writable under the v1.6 rules.
 */
export async function syncPracticePosition(
  uid: string,
  sequenceDay: number,
  currentPhase: PhaseId,
  currentTurn: number
): Promise<void> {
  const phase = encounterFor(sequenceDay).phase;
  const turn = practiceTurnOf(sequenceDay);
  if (phase === currentPhase && turn === currentTurn) return;
  await setDoc(
    doc(db, "users", uid),
    { currentPhase: phase, currentTurn: turn },
    { merge: true }
  );
}

// ─────────────────────────────────────────────────────────────
// Chronological field-notes feed (createdAt DESC)
// Single-field orderBy is auto-indexed; no composite index needed.
// ─────────────────────────────────────────────────────────────

export function fieldNotesQuery(uid: string) {
  return query(
    collection(db, "users", uid, "fieldNotes"),
    orderBy("createdAt", "desc")
  );
}

// ─────────────────────────────────────────────────────────────
// "What you've walked through" — completed encounters, most recent first
// Uses index: userEncounters status ASC, completedAt DESC
// ─────────────────────────────────────────────────────────────

export function walkedThroughQuery(uid: string) {
  return query(
    collection(db, "users", uid, "userEncounters"),
    where("status", "==", "completed"),
    orderBy("completedAt", "desc")
  );
}

// ─────────────────────────────────────────────────────────────
// createFieldNote — §5 / §3
//
// Rules:
//   • captureMode 'audio'  → transcriptStatus: 'pending', content: null
//   • captureMode 'text'   → transcriptStatus: 'none',    content: provided text
//   • charge is NEVER written — not even as null. The security rule requires
//     the field absent on create; writing charge: null would violate it.
// ─────────────────────────────────────────────────────────────

export type CreateFieldNoteInput = {
  type: FieldNoteType;
  captureMode: CaptureMode;
  audioPath?: string;
  content?: string;
  source: NoteSource;
  encounterRef?: string;
  questionId?: string;
  atmosphere: PhaseId;
};

export async function createFieldNote(
  uid: string,
  input: CreateFieldNoteInput
): Promise<string> {
  const isAudio = input.captureMode === "audio";

  // Omit charge entirely — it is engine-only and must be absent, not null.
  const data: Omit<FieldNoteDoc, "charge" | "createdAt"> & { createdAt: FieldValue } = {
    type: input.type,
    captureMode: input.captureMode,
    audioPath: input.audioPath ?? null,
    content: isAudio ? null : (input.content ?? null),
    transcriptStatus: isAudio ? "pending" : "none",
    source: input.source,
    encounterRef: input.encounterRef ?? null,
    questionId: input.questionId ?? null,
    atmosphere: input.atmosphere,
    createdAt: serverTimestamp(),
  };

  const colRef = collection(db, "users", uid, "fieldNotes");
  const docRef = await addDoc(colRef, data);
  return docRef.id;
}

// ─────────────────────────────────────────────────────────────
// deleteFieldNote — §4 sequenced cascade
//
// Privacy contract: the user's voice recording must not outlive the note
// they believe they erased. Order matters — two deletes cannot be atomic:
//
//   1. Delete the Storage object first.
//   2. Only on success, delete the Firestore document.
//
// If step 1 fails, abort and surface the error so the caller can retry.
// The note remains visible. The reverse failure (doc gone, audio orphaned)
// is unrecoverable because nothing points at an orphaned recording.
// ─────────────────────────────────────────────────────────────

export async function deleteFieldNote(
  uid: string,
  noteId: string,
  audioPath?: string | null
): Promise<void> {
  if (audioPath) {
    const fileRef = storageRef(storage, audioPath);
    await deleteObject(fileRef);
    // If deleteObject throws, execution stops here — the Firestore doc is
    // untouched and the user can retry. Do not swallow this error.
  }

  const docRef = doc(db, "users", uid, "fieldNotes", noteId);
  await deleteDoc(docRef);
}
