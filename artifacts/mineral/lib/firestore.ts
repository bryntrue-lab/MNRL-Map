import {
  FieldValue,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

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

function userEncounterRef(uid: string, encounterId: string, turn: number) {
  return doc(db, "users", uid, "userEncounters", userEncounterId(encounterId, turn));
}

export async function getUserEncounter(
  uid: string,
  encounterId: string,
  turn: number
): Promise<UserEncounterDoc | null> {
  const snap = await getDoc(userEncounterRef(uid, encounterId, turn));
  return snap.exists() ? (snap.data() as UserEncounterDoc) : null;
}

/**
 * §9 / Task B §4 — a visit records 'visited' + visitedAt, but must never
 * disturb a stronger status. visitedAt is written on the FIRST visit only;
 * a completed doc keeps its status (completed is terminal for the turn) and
 * only gains visitedAt when it never had one.
 */
export async function recordVisit(
  uid: string,
  encounterId: string,
  turn: number
): Promise<void> {
  const ref = userEncounterRef(uid, encounterId, turn);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
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
    return;
  }
  const existing = snap.data() as UserEncounterDoc;
  if (existing.visitedAt == null) {
    await setDoc(ref, { visitedAt: serverTimestamp() }, { merge: true });
  }
}

/**
 * §1a — an in-sequence Begin. Creates the instance doc as in-progress, or
 * upgrades a previously-visited one (its day has arrived — visitedAt is
 * preserved, this is not a downgrade). Returns the pre-existing doc so the
 * caller can resume from audioPosition / blockIndex; null means fresh start.
 * A completed doc is returned untouched — the caller enters visit framing.
 */
export async function beginSequenceEncounter(
  uid: string,
  encounterId: string,
  turn: number
): Promise<UserEncounterDoc | null> {
  const ref = userEncounterRef(uid, encounterId, turn);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data: Omit<UserEncounterDoc, "startedAt"> & { startedAt: FieldValue } = {
      encounterId,
      turn,
      status: "in-progress",
      startedAt: serverTimestamp(),
      completedAt: null,
      visitedAt: null,
      audioPosition: 0,
      blockIndex: 0,
    };
    await setDoc(ref, data);
    return null;
  }
  const existing = snap.data() as UserEncounterDoc;
  if (existing.status === "visited" || existing.status === "saved") {
    await setDoc(
      ref,
      { status: "in-progress", startedAt: serverTimestamp() },
      { merge: true }
    );
  }
  // Returned with its ORIGINAL status — the caller must distinguish a true
  // in-progress resume from a visited→in-progress upgrade (which starts the
  // flow fresh, even if a visit once captured a note against this doc).
  return existing;
}

/** §1b / §4 — seconds into the audio, persisted for resume. Merge-only. */
export async function saveAudioPosition(
  uid: string,
  encounterId: string,
  turn: number,
  seconds: number
): Promise<void> {
  await setDoc(
    userEncounterRef(uid, encounterId, turn),
    { audioPosition: Math.max(0, Math.round(seconds)) },
    { merge: true }
  );
}

/** §1f / §4 — the block screen the user is on, persisted for resume. */
export async function saveBlockIndex(
  uid: string,
  encounterId: string,
  turn: number,
  blockIndex: number
): Promise<void> {
  await setDoc(
    userEncounterRef(uid, encounterId, turn),
    { blockIndex },
    { merge: true }
  );
}

/**
 * §1g pilgrim close — one atomic batch:
 *   • the instance becomes completed (completedAt server time)
 *   • sequenceDay advances by one (FieldValue.increment)
 *   • currentPhase / currentTurn update when the pointer crosses a boundary
 * completedEncounterCount is NOT touched — server-only (five guarded fields).
 */
export async function completeEncounter(
  uid: string,
  encounterId: string,
  turn: number,
  sequenceDay: number
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    userEncounterRef(uid, encounterId, turn),
    { status: "completed", completedAt: serverTimestamp() },
    { merge: true }
  );

  const next = sequenceDay + 1;
  const updates: {
    sequenceDay: FieldValue;
    currentPhase?: PhaseId;
    currentTurn?: number;
  } = { sequenceDay: increment(1) };
  const nextPhase = encounterFor(next).phase;
  if (nextPhase !== encounterFor(sequenceDay).phase) updates.currentPhase = nextPhase;
  const nextTurn = practiceTurnOf(next);
  if (nextTurn !== practiceTurnOf(sequenceDay)) updates.currentTurn = nextTurn;
  batch.set(doc(db, "users", uid), updates, { merge: true });

  await batch.commit();
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
  audioPath?: string | null;
  content?: string;
  source: NoteSource;
  encounterRef?: string;
  questionId?: string;
  atmosphere: PhaseId;
  /** Voice-path override: when the upload already failed, the note is
   *  created terminally 'failed' — never 'pending' with no audio behind it. */
  transcriptStatus?: "pending" | "failed";
  /** v1.8 §6 — the map position that provoked a counterweight capture. */
  mapRef?: { date: string; phase: PhaseId } | null;
};

/** Pre-generate a note id — the voice path needs it for the Storage path. */
export function newFieldNoteId(uid: string): string {
  return doc(collection(db, "users", uid, "fieldNotes")).id;
}

export function fieldNoteRef(uid: string, noteId: string) {
  return doc(db, "users", uid, "fieldNotes", noteId);
}

export async function createFieldNote(
  uid: string,
  input: CreateFieldNoteInput,
  noteId?: string
): Promise<string> {
  const isAudio = input.captureMode === "audio";

  // Omit charge entirely — it is engine-only and must be absent, not null.
  const data: Omit<FieldNoteDoc, "charge" | "createdAt"> & { createdAt: FieldValue } = {
    type: input.type,
    captureMode: input.captureMode,
    audioPath: input.audioPath ?? null,
    content: isAudio ? null : (input.content ?? null),
    transcriptStatus: input.transcriptStatus ?? (isAudio ? "pending" : "none"),
    source: input.source,
    encounterRef: input.encounterRef ?? null,
    questionId: input.questionId ?? null,
    atmosphere: input.atmosphere,
    createdAt: serverTimestamp(),
    mapRef: input.mapRef ?? null,
  };

  const colRef = collection(db, "users", uid, "fieldNotes");
  if (noteId) {
    await setDoc(doc(colRef, noteId), data);
    return noteId;
  }
  const docRef = await addDoc(colRef, data);
  return docRef.id;
}

/**
 * §1c voice path — upload the recording BEFORE creating the note doc, so the
 * transcription trigger always finds the audio in place. Storage rules gate
 * on contentType audio/* and size < 25MB.
 */
export async function uploadCaptureAudio(
  uid: string,
  noteId: string,
  localUri: string,
  contentType: string
): Promise<string> {
  const ext = contentType.includes("webm")
    ? "webm"
    : contentType.includes("wav")
      ? "wav"
      : "m4a";
  const path = `users/${uid}/fieldNotes/${noteId}/audio.${ext}`;
  const blob = await (await fetch(localUri)).blob();
  await uploadBytes(storageRef(storage, path), blob, { contentType });
  return path;
}

export type FieldNoteWithId = FieldNoteDoc & { id: string };

/**
 * Resume support (§1d) — the crystallizing note for an encounter instance is
 * the one carrying a questionId. Single equality filter; no composite index.
 */
export async function findCrystallizingNote(
  uid: string,
  encounterRef: string
): Promise<FieldNoteWithId | null> {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "fieldNotes"),
      where("encounterRef", "==", encounterRef)
    )
  );
  const hits = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as FieldNoteDoc) }))
    .filter((n) => n.questionId != null)
    .sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );
  return hits[0] ?? null;
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
