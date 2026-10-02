"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const KEY_RE = /^[a-z]+$/;
const DAILY_LIMIT = 10;
const PASSAGES_PER_CALL = 1;
const RUN_LEASE_MS = 6 * 60 * 1000;
const BOUNDED_OUTPUT = "Queue output contract: return exactly ONE passage in the passages array, never three or multiple passages. This overrides any passage-count instruction in the shared prompt. Keep its other editorial and privacy instructions. Return only the requested JSON.";

function contentId(keyType, key) {
  return `${keyType}_${key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function utcDayKey(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function parsePassages(raw) {
  const parsed = JSON.parse(raw);
  const passages = Array.isArray(parsed) ? parsed : parsed?.passages;
  if (!Array.isArray(passages) || passages.length !== PASSAGES_PER_CALL) {
    throw new Error("expected exactly one passage");
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
  const [snapshot, lexicon, allowlist, content] = await Promise.all([
    db.collectionGroup("patterns").get(),
    db.collection("motifLexicon").get(),
    db.doc("practitionerContent/queue_allowlist").get(),
    db.collection("practitionerContent").get(),
  ]);
  // Existing founder-seeded lexicon entries have no status field. Explicit
  // unapproved proposals must not enter this boundary.
  const allowed = new Set(lexicon.docs.map((doc) => doc.data()).filter((entry) =>
    entry && (entry.status == null || entry.status === "approved") &&
    (entry.approval?.status == null || entry.approval.status === "approved") &&
    ["motif", "resistance"].includes(entry.keyType) && Array.isArray(entry.terms) &&
    typeof entry.key === "string" && KEY_RE.test(entry.key)
  ).map((entry) => entry.key));
  const words = allowlist.data();
  if (words?.kind === "queue_allowlist" && Array.isArray(words.words)) {
    for (const key of words.words) {
      if (typeof key === "string" && KEY_RE.test(key)) allowed.add(key);
    }
  }
  const existing = new Map(content.docs.map((doc) => [doc.id, doc.data()]));
  const found = new Map();
  for (const doc of snapshot.docs) {
    // Only root pattern documents, never evidence pages or other groups.
    const match = /^users\/([^/]+)\/patterns\/(motif|thread|resistance)$/.exec(doc.ref.path);
    if (!match) continue;
    const keyType = doc.id === "thread" ? "word" : doc.id;
    if (!keyType) continue;
    for (const [key, count] of Object.entries(doc.data().itemCounts || {})) {
      if (!Number.isFinite(count) || count < 3 || !allowed.has(key)) continue;
      if (hasExistingCopy(existing.get(contentId(keyType, key)))) continue;
      const id = `${keyType}:${key}`;
      const entry = found.get(id) || { key, keyType, users: new Set(), totalCount: 0 };
      if (!entry.users.has(match[1])) {
        entry.users.add(match[1]);
        entry.totalCount += count;
      }
      found.set(id, entry);
    }
  }
  return [...found.values()].map(({ users, ...entry }) => ({
    ...entry, establishedUsers: users.size,
  })).sort((a, b) =>
    b.establishedUsers - a.establishedUsers || b.totalCount - a.totalCount ||
    stableCompare(`${a.key}:${a.keyType}`, `${b.key}:${b.keyType}`)
  );
}

function stableCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function hasExistingCopy(data) {
  // Top-level founder text is a compatibility approval boundary for motif
  // and resistance. Conservatively preserve it for words as well, and never
  // regenerate explicitly rejected documents even if their copy was removed.
  return data?.status === "rejected" || data?.approval?.status === "rejected" ||
    (Array.isArray(data?.passages) && data.passages.length > 0) ||
    (typeof data?.text === "string" && data.text.trim().length > 0);
}

function betaAutoApproveGeneratedOfferings(policy) {
  // Server-owned shared policy, never model output or a client preference.
  // Missing/malformed configuration keeps the normal review gate in place.
  return policy?.kind === "field_generation_policy" &&
    policy.betaAutoApproveGeneratedOfferings === true;
}

function dailyCounts(data, day) {
  if (data.day !== day) return { draftedCount: 0, attemptedCount: 0 };
  // Pre-G2b counters counted three-passage batches, not passages. Migrate
  // conservatively so a same-day deployment cannot reopen spent capacity.
  const multiplier = data.budgetVersion === 2 ? 1 : 3;
  const draftedCount = Math.max(0, Math.ceil(Number(data.draftedCount) || 0)) * multiplier;
  const attemptedCount = Math.max(
    draftedCount, Math.max(0, Math.ceil(Number(data.attemptedCount) || 0)) * multiplier
  );
  return { draftedCount, attemptedCount };
}

async function acquireDailyLease(db) {
  const ref = db.doc("_system/fieldPassageQueue");
  const now = Date.now();
  const day = utcDayKey(now);
  const token = `${now}-${Math.random().toString(36).slice(2)}`;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const { draftedCount, attemptedCount } = dailyCounts(data, day);
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
        budgetVersion: 2,
        draftedCount,
        attemptedCount,
        attemptedKeys:
          data.day === day && Array.isArray(data.attemptedKeys)
            ? data.attemptedKeys
            : [],
        storedKeys:
          data.day === day && Array.isArray(data.storedKeys)
            ? data.storedKeys
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
      day,
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
      stateData.day !== run.day ||
      run.day !== utcDayKey(Date.now()) ||
      stateData.attemptedCount >= DAILY_LIMIT ||
      stateData.draftedCount >= DAILY_LIMIT ||
      (stateData.attemptedKeys || []).includes(`${candidate.keyType}:${candidate.key}`)
    ) {
      return false;
    }
    if (hasExistingCopy(current.data())) {
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
  if (!Array.isArray(passages) || passages.length !== PASSAGES_PER_CALL ||
      passages.some((p) => p?.status !== "draft" || p?.source !== "generated")) {
    throw new Error("only one unapproved generated passage may be stored");
  }
  const ref = db.doc(
    `practitionerContent/${contentId(candidate.keyType, candidate.key)}`
  );
  return db.runTransaction(async (tx) => {
    const [current, state, policy] = await Promise.all([
      tx.get(ref),
      tx.get(run.ref),
      tx.get(db.doc("practitionerContent/field_generation_policy")),
    ]);
    const stateData = state.data() || {};
    if (
      stateData.leaseToken !== run.token ||
      stateData.day !== run.day ||
      run.day !== utcDayKey(Date.now()) ||
      !(stateData.attemptedKeys || []).includes(`${candidate.keyType}:${candidate.key}`) ||
      (stateData.storedKeys || []).includes(`${candidate.keyType}:${candidate.key}`) ||
      stateData.draftedCount + passages.length > DAILY_LIMIT
    ) {
      return false;
    }
    if (hasExistingCopy(current.data())) {
      return false;
    }
    // Decide approval at publication time inside the transaction. The model
    // parser always produces drafts; only this server policy may approve them.
    const autoApprove = betaAutoApproveGeneratedOfferings(policy.data());
    const offering = {
      key: candidate.key,
      keyType: candidate.keyType,
      kind: "offering",
      passages: passages.map((passage) => ({
        ...passage, status: autoApprove ? "approved" : "draft",
      })),
    };
    if (autoApprove) {
      // No competing copy remains after the preservation check above. A legacy
      // empty word shell with status:draft must not hide the approved passage.
      offering.status = "approved";
      if (["motif", "resistance"].includes(candidate.keyType)) {
        offering.text = passages[0].text;
      }
    }
    tx.set(
      ref,
      offering,
      { merge: true }
    );
    tx.update(run.ref, {
      draftedCount: FieldValue.increment(passages.length),
      storedKeys: FieldValue.arrayUnion(`${candidate.keyType}:${candidate.key}`),
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
          // Exact call-site bound as well as the durable transaction bound.
          // No SDK retries: every billable request needs its own reservation.
          if (attempted >= Math.min(DAILY_LIMIT, run.remainingAttempts)) break;
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
                             minItems: PASSAGES_PER_CALL,
                             maxItems: PASSAGES_PER_CALL,
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
                     // Leave the stored shared prompt untouched; override only
                     // its old three-passage batch contract at this call site.
                     { role: "system", content: BOUNDED_OUTPUT },
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

      const totals = await queueCounts(db, run.day);
      if (drafted.length || totals.pendingCount) {
        await db.collection("mail").add({
          to: recipient,
          message: {
            subject: `the field · ${totals.pendingCount} awaiting you`,
            text: [
              `${totals.pendingCount} pending passages total`,
              `${drafted.length} generated this run`,
              `${totals.generatedTodayCount} generated today (${run.day} UTC)`,
              `${totals.attemptedCount} attempts today (including failures)`,
              `drafted keys: ${drafted.join(", ") || "none"}`,
            ].join("\n"),
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
  );
}

async function queueCounts(db, day = utcDayKey(Date.now())) {
  const [content, state] = await Promise.all([
    db.collection("practitionerContent").get(),
    db.doc("_system/fieldPassageQueue").get(),
  ]);
  return { ...countPassageQueue(content), ...dailyCounts(state.data() || {}, day) };
}

function countPassageQueue(snapshot, now = Date.now()) {
  const dayStart = Date.parse(`${utcDayKey(now)}T00:00:00Z`);
  let pendingCount = 0, generatedPast24hCount = 0, generatedTodayCount = 0;
  let hasSchema = false;
  const keys = new Set();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    hasSchema ||= data.kind === "offering" || Array.isArray(data.passages);
    for (const passage of Array.isArray(data.passages) ? data.passages : []) {
      if (passage?.status === "draft") {
        pendingCount++;
        if (typeof data.key === "string") keys.add(data.key);
      }
      if (passage?.source !== "generated") continue;
      const createdAt = passage.createdAt?.toMillis?.() ??
        (typeof passage.createdAt === "number" ? passage.createdAt :
          new Date(passage.createdAt || 0).getTime());
      // Count actual stored generated passages in every approval status, not
      // documents, attempted calls, or a legacy estimated budget counter.
      if (!Number.isFinite(createdAt) || createdAt > now) continue;
      if (createdAt >= now - 24 * 60 * 60 * 1000) generatedPast24hCount++;
      if (createdAt >= dayStart) generatedTodayCount++;
    }
  }
  return {
    pendingCount, generatedPast24hCount, generatedTodayCount,
    keys: [...keys].sort(stableCompare), notRunning: !hasSchema,
  };
}

module.exports = {
  createFieldPassageQueue,
  parsePassages,
  utcDayKey,
  countPassageQueue,
  __test: {
    DAILY_LIMIT, PASSAGES_PER_CALL, acquireDailyLease, reserveCandidate,
    storeDrafts, releaseDailyLease, establishedCandidates, queueCounts,
    hasExistingCopy, dailyCounts, betaAutoApproveGeneratedOfferings,
  },
};