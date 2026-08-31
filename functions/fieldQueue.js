"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const KEY_RE = /^[a-z]+$/;
const DAILY_LIMIT = 3;
const RUN_LEASE_MS = 6 * 60 * 1000;

function contentId(keyType, key) {
  return `${keyType}_${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function utcDayKey(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function parsePassages(raw) {
  const parsed = JSON.parse(raw);
  const passages = Array.isArray(parsed) ? parsed : parsed?.passages;
  if (!Array.isArray(passages) || passages.length !== 3) {
    throw new Error("expected exactly three passages");
  }
  return passages.map((passage) => {
    if (
      !passage ||
      typeof passage.text !== "string" ||
      !passage.text.trim() ||
      typeof passage.locator !== "string" ||
      !passage.locator.trim()
    ) {
      throw new Error("invalid generated passage");
    }
    return {
      text: passage.text.trim(),
      locator: passage.locator.trim(),
      status: "draft",
      source: "generated",
      createdAt: Timestamp.now(),
    };
  });
}

async function establishedCandidates(db) {
  const snapshot = await db.collectionGroup("patterns").get();
  const found = new Map();
  for (const doc of snapshot.docs) {
    const keyType =
      doc.id === "motif" ? "motif" : doc.id === "thread" ? "word" : null;
    if (!keyType) continue;
    for (const [key, count] of Object.entries(doc.data().itemCounts || {})) {
      if (count >= 3 && key.length >= 4 && KEY_RE.test(key)) {
        found.set(`${keyType}:${key}`, { key, keyType });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key));
}

async function acquireDailyLease(db) {
  const ref = db.doc("_system/fieldPassageQueue");
  const now = Date.now();
  const day = utcDayKey(now);
  const token = `${now}-${Math.random().toString(36).slice(2)}`;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const draftedCount =
      data.day === day && Number.isFinite(data.draftedCount)
        ? data.draftedCount
        : 0;
    const attemptedCount =
      data.day === day && Number.isFinite(data.attemptedCount)
        ? data.attemptedCount
        : draftedCount;
    if (attemptedCount >= DAILY_LIMIT) return { acquired: false };
    if (
      data.day === day &&
      Number.isFinite(data.leaseUntilMs) &&
      data.leaseUntilMs > now
    ) {
      return { acquired: false };
    }
    tx.set(
      ref,
      {
        day,
        draftedCount,
        attemptedCount,
        attemptedKeys:
          data.day === day && Array.isArray(data.attemptedKeys)
            ? data.attemptedKeys
            : [],
        leaseToken: token,
        leaseUntilMs: now + RUN_LEASE_MS,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return {
      acquired: true,
      ref,
      token,
      remainingAttempts: DAILY_LIMIT - attemptedCount,
    };
  });
}

async function reserveCandidate(db, run, candidate) {
  const ref = db.doc(
    `practitionerContent/${contentId(candidate.keyType, candidate.key)}`
  );
  return db.runTransaction(async (tx) => {
    const [current, state] = await Promise.all([
      tx.get(ref),
      tx.get(run.ref),
    ]);
    const stateData = state.data() || {};
    if (
      stateData.leaseToken !== run.token ||
      stateData.day !== utcDayKey(Date.now()) ||
      stateData.attemptedCount >= DAILY_LIMIT
    ) {
      return false;
    }
    if (
      Array.isArray(current.data()?.passages) &&
      current.data().passages.length > 0
    ) {
      return false;
    }
    tx.update(run.ref, {
      attemptedCount: FieldValue.increment(1),
      attemptedKeys: FieldValue.arrayUnion(
        `${candidate.keyType}:${candidate.key}`
      ),
      leaseUntilMs: Date.now() + RUN_LEASE_MS,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function storeDrafts(db, run, candidate, passages) {
  const ref = db.doc(
    `practitionerContent/${contentId(candidate.keyType, candidate.key)}`
  );
  return db.runTransaction(async (tx) => {
    const [current, state] = await Promise.all([
      tx.get(ref),
      tx.get(run.ref),
    ]);
    const stateData = state.data() || {};
    if (
      stateData.leaseToken !== run.token ||
      stateData.day !== utcDayKey(Date.now()) ||
      stateData.draftedCount >= DAILY_LIMIT
    ) {
      return false;
    }
    if (
      Array.isArray(current.data()?.passages) &&
      current.data().passages.length > 0
    ) {
      return false;
    }
    tx.set(
      ref,
      {
        key: candidate.key,
        keyType: candidate.keyType,
        kind: "offering",
        passages,
      },
      { merge: true }
    );
    tx.update(run.ref, {
      draftedCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function releaseDailyLease(db, run) {
  if (!run.acquired) return;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(run.ref);
    if (snap.data()?.leaseToken !== run.token) return;
    tx.update(run.ref, {
      leaseToken: FieldValue.delete(),
      leaseUntilMs: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function createFieldPassageQueue({ db, openAiApiKey, founderEmail }) {
  return onSchedule(
    {
      schedule: "0 11 * * *",
      timeZone: "UTC",
      memory: "512MiB",
      timeoutSeconds: 300,
      maxInstances: 1,
      secrets: [openAiApiKey],
    },
    async () => {
      const recipient = founderEmail.value();
      if (!recipient) throw new Error("FOUNDER_DIGEST_EMAIL is not set");

      const run = await acquireDailyLease(db);
      if (!run.acquired) return;

      const drafted = [];
      let attempted = 0;
      try {
        const promptSnap = await db
          .doc("practitionerContent/passage_prompt")
          .get();
        const systemPrompt =
          promptSnap.data()?.kind === "passage_prompt"
            ? promptSnap.data().text
            : null;
        if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
          throw new Error("passage_prompt is missing or invalid");
        }

        const candidates = await establishedCandidates(db);
        for (const candidate of candidates) {
          if (attempted >= run.remainingAttempts) break;
          if (!(await reserveCandidate(db, run, candidate))) continue;
          attempted += 1;

          // Privacy checkpoint: this is the complete dynamic prompt. It
          // contains a shared single-word key and no field/account data.
          console.info("field passage generation prompt", {
            prompt: candidate.key,
          });
          try {
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
                  temperature: 0.6,
                  max_tokens: 900,
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "field_passages",
                      strict: true,
                      schema: {
                        type: "object",
                        additionalProperties: false,
                        required: ["passages"],
                        properties: {
                          passages: {
                            type: "array",
                            minItems: 3,
                            maxItems: 3,
                            items: {
                              type: "object",
                              additionalProperties: false,
                              required: ["text", "locator"],
                              properties: {
                                text: { type: "string", minLength: 1 },
                                locator: { type: "string", minLength: 1 },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: candidate.key },
                  ],
                }),
              }
            );
            if (!response.ok) {
              console.error("passage generation failed", {
                key: candidate.key,
                status: response.status,
              });
              break;
            }
            const completion = await response.json();
            const passages = parsePassages(
              completion?.choices?.[0]?.message?.content || ""
            );
            if (await storeDrafts(db, run, candidate, passages)) {
              drafted.push(candidate.key);
            }
          } catch (error) {
            console.error("passage candidate failed", {
              key: candidate.key,
              message: error?.message,
            });
          }
        }
      } finally {
        await releaseDailyLease(db, run);
      }

      if (drafted.length) {
        await db.collection("mail").add({
          to: recipient,
          message: {
            subject: `the field drafted ${drafted.length * 3} passages`,
            text: drafted.join("\n"),
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
  );
}

module.exports = {
  createFieldPassageQueue,
  parsePassages,
  utcDayKey,
};