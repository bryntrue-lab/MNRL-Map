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
const { defineSecret, defineString } = require("firebase-functions/params");
const { getAuth } = require("firebase-admin/auth");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const speech = require("@google-cloud/speech");

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const founderDigestEmail = defineString("FOUNDER_DIGEST_EMAIL");
const { createBetaRequest } = require("./betaRequest");
const { createFieldPassageQueue } = require("./fieldQueue");
const { createFounderDigest } = require("./founderDigest");

exports.betaRequest = createBetaRequest({ db: getFirestore() });
exports.fieldPassageQueue = createFieldPassageQueue({
  db: getFirestore(),
  openAiApiKey,
  founderEmail: founderDigestEmail,
});
exports.founderDigest = createFounderDigest({
  db: getFirestore(),
  auth: getAuth(),
  founderEmail: founderDigestEmail,
});

const DEFAULT_READING_PROMPT = `You are the voice of Mineral's Field Guide — an old, kind, unhurried practice companion. You are given a person's recent field notes (their private reflections, dated and typed) and the patterns the guide has counted. Write them a reading.

Rules, absolute: Work only from what is in the notes — never invent events, feelings, or facts. Quote their exact words often; quoted spans must appear verbatim in a note. Never advise, prescribe, diagnose, flatter, or predict. Never mention being an AI, a model, or a system. No therapy language, no productivity language, no exclamation marks. Do not summarize note by note — read across them: name what returns, what has shifted since the earliest notes, what sits next to what. It is enough to notice; you do not need to resolve.

Form: three short paragraphs at most, under 180 words total, then exactly one quiet question the notes themselves seem to be asking. Lowercase-comfortable, present tense, plain words.`;

function readingUserMessage(notes, patterns, noteCount, dayCount) {
  const noteLines = notes.map((note) => {
    const createdAt = note.createdAt?.toDate?.();
    const date = createdAt ? createdAt.toISOString().slice(0, 10) : "date unknown";
    return [
      `[${date} · ${note.type ?? "note"}${note.encounterRef ? ` · ${note.encounterRef}` : ""}]`,
      note.content,
    ].join("\n");
  });
  const patternLines = patterns.map(({ id, data }) => {
    const counts = Object.entries(data?.itemCounts ?? {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item, count]) => `${item} (${count})`)
      .join(", ");
    return `${id}: ${counts || "nothing counted yet"}`;
  });
  return [
    `FIELD: ${noteCount} notes across ${dayCount} day${dayCount === 1 ? "" : "s"}.`,
    "",
    "RECENT NOTES (newest first):",
    noteLines.join("\n\n"),
    "",
    "COUNTED PATTERNS:",
    patternLines.join("\n"),
    "",
    'Return JSON only in this shape: {"paragraphs":[{"spans":[{"text":"...","quote":false}]}],"question":"..."}',
  ].join("\n");
}

function normalizeReading(rawText, noteTexts) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      paragraphs: [{ spans: [{ text: rawText.trim(), quote: false }] }],
      question: "",
    };
  }

  const paragraphs = Array.isArray(parsed?.paragraphs)
    ? parsed.paragraphs.slice(0, 3).map((paragraph) => ({
        spans: Array.isArray(paragraph?.spans)
          ? paragraph.spans
              .filter((span) => typeof span?.text === "string" && span.text.length > 0)
              .map((span) => {
                const isVerbatim =
                  span.quote === true && noteTexts.some((text) => text.includes(span.text));
                return { text: span.text, quote: isVerbatim };
              })
          : [],
      })).filter((paragraph) => paragraph.spans.length > 0)
    : [];

  if (paragraphs.length === 0) {
    return {
      paragraphs: [{ spans: [{ text: rawText.trim(), quote: false }] }],
      question: "",
    };
  }
  return {
    paragraphs,
    question: typeof parsed.question === "string" ? parsed.question.trim() : "",
  };
}

const READING_REST_MS = 20 * 60 * 60 * 1000;
const READING_LEASE_MS = 3 * 60 * 1000;

/**
 * The letter request is a deliberately narrow privacy boundary: no caller
 * payload is accepted and no note text is copied. It uses only a direct
 * fieldNotes count plus a one-document `createdAt` projection, never a full
 * note document. It does not read patterns or any pattern-derived metadata.
 *
 * The timestamp-only query replaces the former `patterns/conditions`
 * aggregate: exact elapsed Guide days still require the earliest note time,
 * but letter eligibility must remain available when pattern rebuilding is
 * delayed or unavailable.
 */
function createRequestLetterHandler({ db, serverTimestamp, now = () => Date.now() }) {
  return async (request) => {
    const uid = request.auth?.uid;
    const tokenEmail = request.auth?.token?.email;
    const email =
      typeof tokenEmail === "string" ? tokenEmail.trim() : "";
    if (!uid) {
      throw new HttpsError("unauthenticated", "sign in to ask for a letter.");
    }
    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "an email is required to ask for a letter."
      );
    }

    const userRef = db.doc(`users/${uid}`);
    const notesRef = userRef.collection("fieldNotes");
    // These are the only fieldNotes operations in this callable. The second
    // read projects only the earliest timestamp needed for the exact elapsed
    // day span; it never reads note content or a full note document.
    const [countSnap, earliestSnap] = await Promise.all([
      notesRef.count().get(),
      notesRef
        .select("createdAt")
        .orderBy("createdAt")
        .limit(1)
        .get(),
    ]);
    const noteCount = countSnap.data().count;
    if (!Number.isInteger(noteCount) || noteCount < 15) {
      throw new HttpsError(
        "failed-precondition",
        "the field needs fifteen notes."
      );
    }

    const firstNoteAtMs = earliestSnap.docs[0]?.data()?.createdAt?.toMillis?.();
    if (!Number.isFinite(firstNoteAtMs)) {
      throw new HttpsError(
        "failed-precondition",
        "the field is still settling."
      );
    }
    // Exact Guide definition: elapsed UTC-day span from the earliest note,
    // inclusive. Do not substitute active-note days (`daysRead`) here.
    const dayCount = Math.floor((now() - firstNoteAtMs) / 86400000) + 1;
    if (!Number.isInteger(dayCount) || dayCount < 1) {
      throw new HttpsError(
        "failed-precondition",
        "the field is still settling."
      );
    }

    const requestRef = db.doc(`letterRequests/${uid}`);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(requestRef);
      if (existing.exists) {
        // Idempotency: keep the original request (including createdAt and a
        // console-set answered status); a repeat only records that it was asked.
        transaction.update(requestRef, { lastAskedAt: serverTimestamp() });
        return;
      }
      transaction.create(requestRef, {
        email,
        noteCount,
        dayCount,
        createdAt: serverTimestamp(),
        status: "new",
      });
    });
    return { ok: true };
  };
}

const requestLetterHandler = createRequestLetterHandler({
  db: getFirestore(),
  serverTimestamp: () => FieldValue.serverTimestamp(),
});

exports.requestLetter = onCall(async (request) => requestLetterHandler(request));

async function waitForConcurrentReading(readingsRef, startedAtMs) {
  // A concurrent caller owns generation. Wait for its completed document
  // rather than invoking OpenAI twice or exposing the private lease doc.
  for (let attempt = 0; attempt < 95; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const latestSnap = await readingsRef
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const latestDoc = latestSnap.docs[0];
    const createdMs = latestDoc?.data()?.createdAt?.toMillis?.() ?? 0;
    if (latestDoc && createdMs >= startedAtMs) return { id: latestDoc.id };

    const leaseSnap = await readingsRef.doc("_generation").get();
    if (!leaseSnap.exists) break;
  }
  throw new HttpsError("internal", "the reading did not arrive.");
}

async function releaseReadingLease(db, leaseRef, leaseToken) {
  await db.runTransaction(async (transaction) => {
    const liveLease = await transaction.get(leaseRef);
    if (liveLease.data()?.token === leaseToken) transaction.delete(leaseRef);
  });
}

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
  rebuildPatternsForUser,
} = require("./patternEngine");

exports.updatePatterns = onDocumentWritten(
  {
    document: "users/{uid}/fieldNotes/{noteId}",
    memory: "512MiB",
    timeoutSeconds: 300,
    retry: true,
  },
  async (event) => {
    // Field-wide patterns depend on mutable vocabulary and on a note's
    // content, type, capture context, and existence. A direct recomputation
    // makes create, edit, delete, and transcript completion converge without
    // leaving stale contributions behind.
    await rebuildPatternsForUser(event.params.uid, { coalesce: true });
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
    return await rebuildPatternsForUser(uid);
  }
);

/**
 * requestReading (Slice L): founder-gated, user-initiated synthesis across
 * the caller's own field. The user-doc gate is checked before notes,
 * patterns, or the generation service are touched.
 */
exports.requestReading = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: [openAiApiKey],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "sign in to ask the field.");
    }

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    // Privacy boundary: no client-supplied identity and no data gathering
    // before the server-controlled founder flag is proven true.
    if (!userSnap.exists || userSnap.data()?.readingsEnabled !== true) {
      throw new HttpsError("permission-denied", "readings are not enabled.");
    }

    const readingsRef = userRef.collection("readings");
    const leaseRef = readingsRef.doc("_generation");
    const leaseToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const admission = await db.runTransaction(async (transaction) => {
      const leaseSnap = await transaction.get(leaseRef);
      const latestSnap = await transaction.get(
        readingsRef.orderBy("createdAt", "desc").limit(1)
      );
      const latestMs =
        latestSnap.docs[0]?.data()?.createdAt?.toMillis?.() ?? 0;
      if (latestMs && Date.now() - latestMs < READING_REST_MS) {
        throw new HttpsError(
          "resource-exhausted",
          "the field rests until tomorrow."
        );
      }

      const leaseStartedAt = leaseSnap.data()?.startedAtMs;
      if (
        typeof leaseStartedAt === "number" &&
        Date.now() - leaseStartedAt < READING_LEASE_MS
      ) {
        return { acquired: false, startedAtMs: leaseStartedAt };
      }

      const startedAtMs = Date.now();
      transaction.set(leaseRef, { token: leaseToken, startedAtMs });
      return { acquired: true, startedAtMs };
    });

    if (!admission.acquired) {
      return await waitForConcurrentReading(
        readingsRef,
        admission.startedAtMs
      );
    }

    try {
      const notesRef = userRef.collection("fieldNotes");
      const [notesSnap, countSnap, earliestSnap, patternSnaps, promptSnap] =
        await Promise.all([
          notesRef.orderBy("createdAt", "desc").limit(40).get(),
          notesRef.count().get(),
          notesRef.orderBy("createdAt", "asc").limit(1).get(),
          Promise.all(
            ["thread", "motif", "resistance"].map(async (id) => ({
              id,
              data:
                (await userRef.collection("patterns").doc(id).get()).data() ??
                {},
            }))
          ),
          db.doc("practitionerContent/reading_prompt").get(),
        ]);

      if (notesSnap.size < 7) {
        throw new HttpsError(
          "failed-precondition",
          "the field needs seven notes."
        );
      }
      const notes = notesSnap.docs
        .map((doc) => doc.data())
        .filter(
          (note) =>
            typeof note.content === "string" &&
            note.content.trim().length > 0
        );

      const noteCount = countSnap.data().count;
      const earliest = earliestSnap.docs[0]?.data()?.createdAt?.toMillis?.();
      const dayCount = earliest
        ? Math.floor((Date.now() - earliest) / 86400000) + 1
        : 1;
      const systemPrompt =
        promptSnap.exists &&
        promptSnap.data()?.kind === "reading_prompt" &&
        typeof promptSnap.data()?.text === "string"
          ? promptSnap.data().text
          : DEFAULT_READING_PROMPT;
      const userMessage = readingUserMessage(
        notes,
        patternSnaps,
        noteCount,
        dayCount
      );

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiApiKey.value()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.5,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        }
      );
      if (!response.ok) {
        const detail = await response.text();
        console.error(
          "reading generation failed",
          response.status,
          detail.slice(0, 500)
        );
        throw new HttpsError("internal", "the reading did not arrive.");
      }
      const completion = await response.json();
      const rawText = completion?.choices?.[0]?.message?.content;
      if (typeof rawText !== "string" || rawText.trim().length === 0) {
        throw new HttpsError("internal", "the reading did not arrive.");
      }

      const reading = normalizeReading(
        rawText,
        notes.map((note) => note.content)
      );
      const created = await readingsRef.add({
        ...reading,
        createdAt: FieldValue.serverTimestamp(),
        noteCount,
      });
      return { id: created.id };
    } catch (error) {
      console.error("requestReading failed", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "the reading did not arrive.");
    } finally {
      await releaseReadingLease(db, leaseRef, leaseToken);
    }
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

// Unit tests exercise the privacy-critical callable through its injected
// dependencies. This is never exported in deployed function manifests.
if (process.env.NODE_ENV === "test") {
  exports.__test = { createRequestLetterHandler };
}
