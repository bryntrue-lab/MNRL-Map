"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const {
  createResistanceVocabularyHandlers, generateProposal, validateEntries, digest,
} = require("./resistanceVocabulary");

// All storage and network are offline fakes. Never initialize Firebase.
function fakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const reads = [];
  function snap(ref) {
    return { exists: docs.has(ref.path), ref, id: ref.path.split("/").pop(),
      data: () => docs.has(ref.path) ? structuredClone(docs.get(ref.path)) : undefined };
  }
  const db = {
    docs, reads,
    doc(path) { return { path, get: async () => { reads.push(path); return snap({ path }); } }; },
    collection(path) { return { path, collection: true }; },
    async runTransaction(fn) {
      const pending = [];
      const result = await fn({
        async get(ref) {
          reads.push(ref.path);
          if (ref.collection) return { docs: [...docs.keys()]
            .filter((path) => path.startsWith(`${ref.path}/`) && path.split("/").length === 2)
            .map((path) => snap({ path })) };
          return snap(ref);
        },
        set(ref, data) { pending.push(() => docs.set(ref.path, data)); },
        create(ref, data) {
          if (docs.has(ref.path)) throw new Error("Already exists");
          pending.push(() => docs.set(ref.path, data));
        },
        update(ref, data) { pending.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data })); },
      });
      pending.forEach((write) => write());
      return result;
    },
  };
  return db;
}

const founder = { uid: "founder", token: { fieldContentAdmin: true } };
const entries = [{ key: "hesitation", terms: ["hesitate", "hold back"] }];
const offering = {
  kind: "offering", keyType: "resistance", status: "approved",
  text: "Approved shared prose, never private note text.",
};
function setup(overrides = {}, initial = {}) {
  const db = fakeDb({
    "practitionerContent/resistance_resistance": offering,
    "motifLexicon/ocean": { key: "ocean", keyType: "motif", terms: ["sea"] },
    "users/founder/fieldNotes/private": { content: "SECRET PRIVATE NOTE" },
    ...initial,
  });
  const generated = [], rebuilt = [];
  const handlers = createResistanceVocabularyHandlers({
    db, openAiApiKey: { value: () => "offline-test-key" },
    now: () => Date.parse("2026-05-12T12:00:00Z"), token: () => "proposal-one",
    generate: async (input) => { generated.push(input); return entries; },
    rebuildPatternsForUser: async (uid) => { rebuilt.push(uid); },
    ...overrides,
  });
  return { db, generated, rebuilt, ...handlers };
}
const request = (data = {}) => ({ auth: founder, data });
const approval = (p) => request({
  proposalId: p.proposalId, version: p.version, proposalHash: p.proposalHash,
  confirm: "APPROVE_EXACT_RESISTANCE_VOCABULARY",
});

test("no identity, ordinary caller, beta reader, forged role/email are denied before reads", async () => {
  const f = setup();
  for (const auth of [undefined, { uid: "other", token: {} },
    { uid: "founder", token: { readingsEnabled: true, role: "founder", email: "founder@example.test" } },
    { uid: "founder", token: { fieldContentAdmin: "true" } }]) {
    for (const handler of [f.draft, f.approve]) {
      await assert.rejects(handler({ auth, data: {} }),
        (e) => e.code === (auth ? "permission-denied" : "unauthenticated"));
    }
  }
  assert.deepEqual(f.db.reads, []);
  assert.equal(f.generated.length, 0);
});

test("draft stores separate non-active proposal, preserves copy/lexicon and sends no notes", async () => {
  const f = setup();
  const before = structuredClone(f.db.docs.get("motifLexicon/ocean"));
  const p = await f.draft(request());
  assert.equal(p.status, "draft");
  assert.equal(f.db.docs.get(`resistanceVocabularyProposals/${p.proposalId}`).status, "draft");
  assert.equal(f.db.docs.has("motifLexicon/hesitation"), false);
  assert.deepEqual(f.db.docs.get("motifLexicon/ocean"), before);
  assert.deepEqual(f.db.docs.get("practitionerContent/resistance_resistance"), offering);
  assert.deepEqual(f.generated, [{ apiKey: "offline-test-key", sourceText: offering.text }]);
  assert.ok(f.db.reads.every((path) => !path.startsWith("users/")));
  assert.deepEqual(f.rebuilt, []);
  await assert.rejects(f.draft(request()), (e) => e.code === "resource-exhausted");
  assert.equal(f.generated.length, 1);
});

test("draft rejects arbitrary text and unapproved shared offering", async () => {
  const f = setup();
  await assert.rejects(f.draft(request({ notes: "PRIVATE" })), { code: "invalid-argument" });
  assert.deepEqual(f.db.reads, []);
  const bad = setup({}, { "practitionerContent/resistance_resistance": { ...offering, status: "draft" } });
  await assert.rejects(bad.draft(request()), { code: "failed-precondition" });
  assert.equal(bad.generated.length, 0);
});

test("stale hash/version, missing explicit action and edited proposal are rejected", async () => {
  const f = setup();
  const p = await f.draft(request());
  for (const change of [{ version: 2 }, { proposalHash: "0".repeat(64) }, { confirm: false }]) {
    const a = approval(p);
    Object.assign(a.data, change);
    await assert.rejects(f.approve(a));
  }
  f.db.docs.get(`resistanceVocabularyProposals/${p.proposalId}`).entries = [{ key: "changed", terms: ["different"] }];
  await assert.rejects(f.approve(approval(p)), { code: "failed-precondition" });
  assert.equal(f.db.docs.has("motifLexicon/hesitation"), false);
  assert.deepEqual(f.rebuilt, []);
});

test("explicit approval activates exact resistance terms and rebuilds self; retries are safe", async () => {
  const f = setup();
  const p = await f.draft(request());
  assert.equal((await f.approve(approval(p))).rebuilt, true);
  const active = f.db.docs.get("motifLexicon/hesitation");
  assert.equal(active.keyType, "resistance");
  assert.equal(active.status, "approved");
  assert.deepEqual(active.terms, entries[0].terms);
  assert.deepEqual(f.rebuilt, ["founder"]);
  assert.deepEqual(f.db.docs.get("motifLexicon/ocean"), { key: "ocean", keyType: "motif", terms: ["sea"] });
  assert.deepEqual(f.db.docs.get("practitionerContent/resistance_resistance"), offering);
  await f.approve(approval(p));
  assert.deepEqual(f.rebuilt, ["founder", "founder"]);
});

test("existing key collision aborts entire approval without overwrites", async () => {
  const existing = { key: "hesitation", keyType: "motif", terms: ["existing"], custom: true };
  const f = setup({}, { "motifLexicon/other-id": existing });
  const p = await f.draft(request());
  await assert.rejects(f.approve(approval(p)), { code: "already-exists" });
  assert.deepEqual(f.db.docs.get("motifLexicon/other-id"), existing);
  assert.equal(f.db.docs.has("motifLexicon/hesitation"), false);
  assert.equal(f.db.docs.get(`resistanceVocabularyProposals/${p.proposalId}`).status, "draft");
});

test("failed generation consumes daily attempt; active lease blocks generation", async () => {
  const f = setup({ generate: async () => { throw new Error("offline failure"); } });
  await assert.rejects(f.draft(request()), /offline failure/);
  await assert.rejects(f.draft(request()), { code: "resource-exhausted" });
  const busy = setup({}, { "_system/resistanceVocabulary": {
    day: "2026-05-12", attempts: 0, leaseUntilMs: Date.parse("2026-05-12T12:01:00Z"),
  } });
  await assert.rejects(busy.draft(request()), { code: "resource-exhausted" });
  assert.equal(busy.generated.length, 0);
});

test("rebuild failure leaves approved vocabulary and exact retry recovers", async () => {
  let calls = 0;
  const f = setup({ rebuildPatternsForUser: async () => { if (++calls === 1) throw new Error("offline"); } });
  const p = await f.draft(request());
  await assert.rejects(f.approve(approval(p)), { code: "unavailable" });
  assert.equal(f.db.docs.get("motifLexicon/hesitation").status, "approved");
  assert.equal((await f.approve(approval(p))).rebuilt, true);
});

test("safe bounded exact entries only; no regex, path, duplicate or unbounded vocabulary", () => {
  for (const invalid of [
    [], [{ key: "../bad", terms: ["term"] }], [{ key: "valid", terms: [".*"] }],
    [{ key: "valid", terms: [" padded"] }], [{ key: "valid", terms: ["same", "same"] }],
    [{ key: "valid", terms: Array(13).fill("many") }], [entries[0], entries[0]],
  ]) assert.throws(() => validateEntries(invalid), { code: "invalid-argument" });
  assert.deepEqual(validateEntries(entries), entries);
});

test("actual HTTP payload contains only shared prose and bounded prompt contract", async () => {
  let body;
  const result = await generateProposal({
    apiKey: "offline", sourceText: offering.text,
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ entries }) } }] }) };
    },
  });
  assert.deepEqual(result, entries);
  assert.equal(body.messages[1].content, offering.text);
  assert.equal(body.messages.length, 2);
  assert.ok(!JSON.stringify(body).includes("SECRET PRIVATE NOTE"));
  assert.equal(body.max_tokens, 1000);
});

test("proposal and active lexicon have no client write rule", () => {
  const rules = fs.readFileSync(require("node:path").join(__dirname, "../firestore.rules"), "utf8");
  assert.match(rules, /match \/motifLexicon\/\{entryId\} \{\s*allow read, write: if false;/);
  assert.ok(!rules.includes("match /{document=**}"));
  // No proposal match: Firestore default deny protects review state and approval.
  assert.ok(!rules.includes("match /resistanceVocabularyProposals"));
  assert.equal(digest({ version: 1, entries }).length, 64);
});

test("CLI review/dry-run work offline; mismatched explicit version is refused", () => {
  const path = require("node:path");
  const os = require("node:os");
  const { spawnSync } = require("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resistance-review-"));
  const file = path.join(dir, "draft.json");
  const p = {
    proposalId: "offline-proposal", version: 1, status: "draft", entries,
    proposalHash: digest({ version: 1, entries }),
  };
  fs.writeFileSync(file, JSON.stringify(p));
  const cli = path.join(__dirname, "../scripts/resistance-vocabulary.cjs");
  const env = { ...process.env, MINERAL_FOUNDER_ID_TOKEN: "", FIREBASE_PROJECT_ID: "" };
  try {
    const review = spawnSync(process.execPath, [cli, "review", file], { env, encoding: "utf8" });
    assert.equal(review.status, 0, review.stderr);
    assert.deepEqual(JSON.parse(review.stdout), p);
    const dryRun = spawnSync(process.execPath, [cli, "approve", file, "--dry-run"], { env, encoding: "utf8" });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(JSON.parse(dryRun.stdout).dryRun, true);
    const badVersion = spawnSync(process.execPath, [cli, "approve", file, "--approve", "2"], { env, encoding: "utf8" });
    assert.equal(badVersion.status, 1);
    assert.match(badVersion.stderr, /must match the reviewed version/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});