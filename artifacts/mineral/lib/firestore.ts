import {
  FieldValue,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";

import { db, storage } from "@/lib/firebase";
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
// §7 — Today's encounter selection
// ─────────────────────────────────────────────────────────────

export async function getTodayEncounter(
  uid: string,
  currentPhase: PhaseId,
  currentTurn: number
): Promise<(EncounterDoc & { id: string }) | null> {
  // Step 2: Query encounters in the current phase, ordered by sequence.
  const snap = await getDocs(
    query(
      collection(db, "encounters"),
      where("phase", "==", currentPhase),
      orderBy("order", "asc")
    )
  );

  // Step 3: Filter minTurn client-side — combining a range filter with phase + order
  // hits Firestore's range/orderBy restriction; the library is small so this is fine.
  const eligible = snap.docs
    .filter((d) => (d.data() as EncounterDoc).minTurn <= currentTurn)
    .map((d) => ({ id: d.id, ...(d.data() as EncounterDoc) }));

  // Step 4: Build the completed-encounter set for this turn.
  // Doc ids follow the pattern `${encounterId}_t${turn}` (turn-scoped).
  const instanceSnap = await getDocs(
    query(
      collection(db, "users", uid, "userEncounters"),
      where("status", "==", "completed"),
      where("turn", "==", currentTurn)
    )
  );
  const completedIds = new Set(
    instanceSnap.docs.map((d) => (d.data() as UserEncounterDoc).encounterId)
  );

  // Step 5: First encounter in the ordered list that hasn't been completed this turn.
  return eligible.find((e) => !completedIds.has(e.id)) ?? null;
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
