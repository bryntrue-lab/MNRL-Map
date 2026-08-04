"use strict";

/**
 * Mineral — Cloud Functions (Task B §3). One server piece: transcription.
 *
 * transcribeFieldNote:
 *   users/{uid}/fieldNotes/{noteId} onCreate →
 *     captureMode 'audio' + transcriptStatus 'pending' →
 *     Speech-to-Text (v2, latest_long, en-US, punctuation) on the Storage
 *     object at audioPath → content = transcript, transcriptStatus 'done'.
 *     ANY failure → transcriptStatus 'failed' (never leave 'pending' forever;
 *     the client's hold falls through gracefully).
 *
 * countCompletion (v1.6 §6, optional):
 *   userEncounters update to 'completed' → users/{uid}.completedEncounterCount
 *   increments. Server-only field; nothing reads it yet.
 *
 * Neither transcription nor completion counting computes `charge`.
 *
 * updatePatterns (Task D, Slice D.1): the Pattern Engine — see
 * patternEngine.js. Counts and quotes verbatim; never interprets.
 */

const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const speech = require("@google-cloud/speech");

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

exports.transcribeFieldNote = onDocumentCreated(
  {
    document: "users/{uid}/fieldNotes/{noteId}",
    memory: "512MiB",
    timeoutSeconds: 300,
    // Redeliver the event if the handler throws — the only throws below are
    // terminal-status writes that failed, which MUST eventually land.
    retry: true,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const note = snap.data();

    // Text captures ('none') and anything already settled: do nothing.
    if (note.captureMode !== "audio" || note.transcriptStatus !== "pending") {
      return;
    }

    // Retry idempotency: on redelivery, skip notes that already settled
    // (also avoids double Speech billing after a done-write/crash race).
    const live = await snap.ref.get();
    if ((live.data() ?? {}).transcriptStatus !== "pending") return;

    let transcript = null;
    let transcribed = false;
    try {
      if (!note.audioPath) throw new Error("audio note without audioPath");

      const bucket = getStorage().bucket();
      const file = bucket.file(note.audioPath);
      const [exists] = await file.exists();
      if (!exists) throw new Error(`audio object missing: ${note.audioPath}`);

      const client = new speech.v2.SpeechClient();
      const projectId = await client.getProjectId();
      const recognizer = `projects/${projectId}/locations/global/recognizers/_`;

      // batchRecognize + inline response: one code path for any capture
      // length within the function budget; auto-decoding handles m4a/webm/wav.
      const [operation] = await client.batchRecognize({
        recognizer,
        config: {
          autoDecodingConfig: {},
          model: "latest_long",
          languageCodes: ["en-US"],
          features: { enableAutomaticPunctuation: true },
        },
        files: [{ uri: `gs://${bucket.name}/${note.audioPath}` }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      });
      const [response] = await operation.promise();

      const fileResult = Object.values(response.results ?? {})[0];
      if (!fileResult) throw new Error("no recognition result returned");
      if (fileResult.error && fileResult.error.message) {
        throw new Error(fileResult.error.message);
      }

      transcript = (fileResult.transcript?.results ?? [])
        .map((r) => (r.alternatives && r.alternatives[0]?.transcript) || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      transcribed = true;
    } catch (err) {
      console.error("transcription failed", err);
    }

    // Exactly one terminal write, OUTSIDE the try: if it throws, the event
    // redelivers and the pre-check above makes the rerun safe. A note is
    // never left 'pending' by a swallowed write error.
    if (transcribed) {
      // An empty transcript (pure silence) still completes the ritual —
      // the client weaves the ⟡ prompt when content stays null.
      await snap.ref.update({
        content: transcript && transcript.length > 0 ? transcript : null,
        transcriptStatus: "done",
      });
    } else {
      // Graceful degradation — the client's 60s hold fallback covers this.
      await snap.ref.update({ transcriptStatus: "failed" });
    }
  }
);

/**
 * deleteAccount (Task C §3): the caller erases themselves completely.
 * Cascade order — Storage → Firestore → Auth — so a mid-cascade failure
 * leaves the auth record intact and the user can simply call again.
 */
exports.deleteAccount = onCall(
  { memory: "512MiB", timeoutSeconds: 300 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "sign in to release a field.");
    }

    // 1. Storage — every object under users/{uid}/ (voice captures).
    await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });

    // 2. Firestore — users/{uid} and all subcollections (fieldNotes,
    //    userEncounters, patterns, ...).
    await getFirestore().recursiveDelete(getFirestore().doc(`users/${uid}`));

    // 3. Auth — last, so a partial failure above remains recoverable.
    await getAuth().deleteUser(uid);

    return { ok: true };
  }
);

/**
 * updatePatterns (Task D §1): one function, all three moments —
 *   create  → text captures (content present immediately)
 *   update  → audio captures, when transcriptStatus flips to 'done'
 *   delete  → reversal; a deleted note leaves no residue
 * Double-processing is guarded by the `processed` ledger ON the pattern
 * docs (clients own fieldNotes — nothing is written there).
 */
const {
  updatePatternsForNote,
  backfillPatternsForUser,
} = require("./patternEngine");

exports.updatePatterns = onDocumentWritten(
  {
    document: "users/{uid}/fieldNotes/{noteId}",
    memory: "256MiB",
    timeoutSeconds: 120,
    retry: true, // ledger makes redelivery safe in both directions
  },
  async (event) => {
    const { uid, noteId } = event.params;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    if (!after && before) {
      // Delete: reverse whatever this note contributed, recomputed from
      // its own final content.
      await updatePatternsForNote(uid, noteId, before, "remove");
      return;
    }
    if (!after) return;

    const isCreateWithContent = !before && !!after.content;
    const transcriptJustLanded =
      !!before &&
      before.transcriptStatus !== "done" &&
      after.transcriptStatus === "done" &&
      !!after.content;

    if (isCreateWithContent || transcriptJustLanded) {
      await updatePatternsForNote(uid, noteId, after, "add");
      // Self-healing (Slice D.3 Part A): if earlier notes never made it
      // into the ledgers (e.g. they predate an engine deploy), sweep them
      // through the same pipeline now. Idempotent; usually a no-op scan.
      try {
        await backfillPatternsForUser(uid);
      } catch (err) {
        // The triggering note itself was processed; a failed sweep must
        // not fail (and re-deliver) the event. The next note retries it.
        console.error("backfill sweep failed", { uid }, err);
      }
    }
  }
);

/**
 * backfillPatterns (Slice D.3 Part A): self-only callable that runs the
 * engine over every fieldNote the ledgers have never seen. Same guard
 * shape as deleteAccount — the caller can only backfill themselves.
 */
exports.backfillPatterns = onCall(
  { memory: "256MiB", timeoutSeconds: 300 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "sign in to tend a field.");
    }
    return await backfillPatternsForUser(uid);
  }
);

exports.countCompletion = onDocumentUpdated(
  "users/{uid}/userEncounters/{docId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "completed" || after.status !== "completed") return;

    await getFirestore()
      .doc(`users/${event.params.uid}`)
      .update({ completedEncounterCount: FieldValue.increment(1) });
  }
);
