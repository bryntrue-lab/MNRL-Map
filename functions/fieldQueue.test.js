"use strict";

// Offline VM: no credentials, remote reads, live writes, or model calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { __test: offeringReaders } = require("./patternEngine");

// Exercise the unchanged client approved-only resolver as well as the server.
const ts = require("typescript");
const guideContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(
  __dirname, "../artifacts/mineral/lib/guideOfferings.ts"
), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, guideContext);
const { guideOfferingText } = guideContext.exports;

const POLICY_PATH = "practitionerContent/field_generation_policy";
const policyData = (enabled) => ({
  kind: "field_generation_policy", betaAutoApproveGeneratedOfferings: enabled,
});

function harness(initial = [], options = {}) {
  const store = new Map(initial);
  const reads = [];
  const calls = [];
  const messages = [];
  let now = Date.parse("2026-07-12T11:00:00Z");
  let transactionTail = Promise.resolve();
  const operation = (op, value) => ({ op, value });
  const FieldValue = {
    increment: (value) => operation("increment", value),
    arrayUnion: (value) => operation("arrayUnion", value),
    delete: () => operation("delete"),
    serverTimestamp: () => operation("time", now),
  };
  function apply(ref, values, merge) {
    const data = merge ? { ...store.get(ref.path) } : {};
    for (const [key, value] of Object.entries(values)) {
      if (value?.op === "increment") data[key] = (data[key] || 0) + value.value;
      else if (value?.op === "arrayUnion") data[key] = [...new Set([...(data[key] || []), value.value])];
      else if (value?.op === "delete") delete data[key];
      else if (value?.op === "time") data[key] = value.value;
      else data[key] = value;
    }
    store.set(ref.path, data);
  }
  const reference = (p) => ({
    path: p,
    get: async () => {
      reads.push(p);
      return { id: p.split("/").at(-1), ref: reference(p),
        exists: store.has(p), data: () => store.get(p) };
    },
  });
  async function documents(predicate) {
    return { docs: await Promise.all([...store.keys()].filter(predicate).map((p) => reference(p).get())) };
  }
  const db = {
    doc: reference,
    collection: (p) => ({
      get: () => documents((key) => key.startsWith(`${p}/`) && !key.slice(p.length + 1).includes("/")),
      add: async (value) => { messages.push(value); },
    }),
    collectionGroup: (name) => {
      assert.equal(name, "patterns", "no fieldNotes or account reads");
      return { get: () => documents((key) => key.split("/").at(-2) === name) };
    },
    runTransaction: (callback) => {
      const task = transactionTail.then(async () => {
        const writes = [];
        const result = await callback({
          get: (ref) => ref.get(),
          set: (ref, values, opt) => writes.push(() => apply(ref, values, opt?.merge)),
          update: (ref, values) => writes.push(() => apply(ref, values, true)),
        });
        writes.forEach((write) => write());
        return result;
      });
      transactionTail = task.catch(() => {});
      return task;
    },
  };
  class Clock extends Date {
    static now() { return now; }
  }
  const context = {
    module: { exports: {} }, Date: Clock,
    console: { info() {}, error() {} },
    require: (name) => {
      if (name === "firebase-functions/v2/scheduler") {
        return { onSchedule: (schedule, handler) => { assert.equal(schedule.maxInstances, 1); return handler; } };
      }
      assert.equal(name, "firebase-admin/firestore");
      return { FieldValue, Timestamp: { now: () => now } };
    },
    fetch: async (url, request) => {
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(request.body);
      calls.push(body);
      if (options.fetch) return options.fetch(body, calls.length);
      return { ok: true, json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          passages: [{ text: "offline generated response", locator: "offline locator" }],
        }) } }],
      }) };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "fieldQueue.js"), "utf8"), context);
  const exports = context.module.exports;
  return {
    ...exports, store, reads, calls, messages, db,
    setNow: (value) => { now = Date.parse(value); },
    handler: exports.createFieldPassageQueue({
      db, openAiApiKey: { value: () => "offline-only" },
      founderEmail: { value: () => "founder@example.invalid" },
    }),
  };
}

function candidateData(count = 15) {
  const words = Array.from({ length: count }, (_, i) => `key${String.fromCharCode(97 + i)}`);
  return [
    ["practitionerContent/passage_prompt", { kind: "passage_prompt", text: "Return three passages. Shared editorial prompt." }],
    ["practitionerContent/queue_allowlist", { kind: "queue_allowlist", words }],
    ["users/offline/patterns/thread", {
      itemCounts: Object.fromEntries(words.map((key) => [key, 3])),
      exemplars: { private: "THIS MUST NEVER REACH THE MODEL" },
      email: "PRIVATE ACCOUNT DATA",
    }],
  ];
}

async function run() {
  const h = harness(candidateData());
  assert.equal(h.__test.DAILY_LIMIT, 10);
  assert.equal(h.__test.PASSAGES_PER_CALL, 1);
  assert.throws(() => h.parsePassages(JSON.stringify({ passages: [{}, {}, {}] })), /exactly one/);
  assert.throws(() => h.parsePassages(JSON.stringify({ passages: [{ text: " ", locator: "x" }] })), /invalid/);
  const parsed = h.parsePassages(JSON.stringify({
    passages: [{ text: " x ", locator: " y ", status: "approved", source: "founder" }],
  }));
  assert.equal(parsed[0].status, "draft");
  assert.equal(parsed[0].source, "generated");
  assert.equal(parsed[0].text, "x");
  for (const policy of [
    undefined, {}, policyData(false), policyData("true"),
    { kind: "offering", betaAutoApproveGeneratedOfferings: true },
  ]) {
    assert.equal(h.__test.betaAutoApproveGeneratedOfferings(policy), false);
  }
  assert.equal(h.__test.betaAutoApproveGeneratedOfferings(policyData(true)), true);
  await Promise.all([h.handler(), h.handler(), h.handler()]);
  assert.equal(h.calls.length, 10, "concurrent scheduled invocations share the hard daily budget");
  assert.equal(h.messages.length, 1);
  assert.match(h.messages[0].message.subject, /10 awaiting you/);
  assert.match(h.messages[0].message.text, /10 generated this run/);
  assert.match(h.messages[0].message.text, /10 generated today/);
  for (const call of h.calls) {
    assert.equal(call.response_format.json_schema.schema.properties.passages.minItems, 1);
    assert.equal(call.response_format.json_schema.schema.properties.passages.maxItems, 1);
    assert.equal(call.messages.length, 3);
    assert.match(call.messages[1].content, /exactly ONE.*overrides/);
    assert.equal(call.messages[2].role, "user");
    assert.match(call.messages[2].content, /^[a-z]+$/);
    assert.doesNotMatch(JSON.stringify(call), /PRIVATE|exemplars|itemCounts|offline\/patterns|email/);
  }
  const state = h.store.get("_system/fieldPassageQueue");
  assert.equal(state.draftedCount, 10);
  assert.equal(state.attemptedCount, 10);
  assert.equal(state.attemptedKeys.length, 10);
  for (const [p, value] of h.store) {
    if (!p.startsWith("practitionerContent/word_")) continue;
    assert.equal(value.passages.length, 1);
    assert.equal(value.passages[0].status, "draft");
    assert.equal(value.text, undefined, "generated drafts must never set approved hero text");
  }
  await h.handler();
  assert.equal(h.calls.length, 10, "same-day retry cannot reopen capacity");
  h.setNow("2026-07-13T11:00:00Z");
  await h.handler();
  assert.equal(h.calls.length, 15, "next UTC day opens a new budget but preserves existing passages");
  assert.match(h.messages.at(-1).message.subject, /15 awaiting you/);
  assert.match(h.messages.at(-1).message.text, /5 generated this run/);
  assert.match(h.messages.at(-1).message.text, /5 generated today/);

  // Explicit false remains draft-only; true approves offering prose only.
  // New documents and empty draft shells must both be immediately readable.
  for (const enabled of [false, true]) {
    const generated = harness([
      ...candidateData(1),
      [POLICY_PATH, policyData(enabled)],
      ["motifLexicon/water", { key: "water", keyType: "motif", terms: ["water"] }],
      ["motifLexicon/fear", { key: "fear", keyType: "resistance", terms: ["fear"] }],
      ["motifLexicon/proposal", { key: "proposal", keyType: "resistance", terms: ["proposal"], status: "draft" }],
      ["users/offline/patterns/motif", { itemCounts: { water: 3 } }],
      ["users/offline/patterns/resistance", { itemCounts: { fear: 3, proposal: 99 } }],
    ]);
    const lexiconBefore = JSON.stringify([...generated.store].filter(([p]) => p.startsWith("motifLexicon/")));
    await generated.handler();
    assert.equal(generated.calls.length, 3);
    for (const [keyType, key] of [["word", "keya"], ["motif", "water"], ["resistance", "fear"]]) {
      const content = generated.store.get(`practitionerContent/${keyType}_${key}`);
      assert.equal(content.passages.length, 1);
      assert.equal(content.passages[0].status, enabled ? "approved" : "draft");
      assert.equal(content.passages[0].source, "generated");
      assert.equal(content.status, enabled ? "approved" : undefined);
      assert.equal(content.text, enabled && keyType !== "word" ? content.passages[0].text : undefined);
      const expected = enabled ? content.passages[0].text : null;
      assert.equal(offeringReaders.offeringText(content, keyType), expected);
      assert.equal(guideOfferingText(content, keyType), expected);
    }
    assert.equal(generated.store.has("practitionerContent/resistance_proposal"), false);
    assert.equal(JSON.stringify([...generated.store].filter(([p]) => p.startsWith("motifLexicon/"))), lexiconBefore,
      "offering autoapproval neither approves nor expands resistance vocabulary");
    assert.equal([...generated.store.keys()].some((p) => p.startsWith("resistanceVocabularyProposals/")), false);
    assert.equal(generated.store.get(POLICY_PATH).betaAutoApproveGeneratedOfferings, enabled);
    const counts = await generated.__test.queueCounts(generated.db);
    assert.equal(counts.pendingCount, enabled ? 0 : 3);
    assert.equal(counts.generatedTodayCount, 3);
    assert.equal(counts.attemptedCount, 3);

    const shell = harness([
      ...candidateData(1), [POLICY_PATH, policyData(enabled)],
      ["practitionerContent/word_keya", { status: "draft", passages: [], metadata: "preserve" }],
    ]);
    await shell.handler();
    const word = shell.store.get("practitionerContent/word_keya");
    assert.equal(word.status, enabled ? "approved" : "draft");
    assert.equal(word.metadata, "preserve");
    assert.equal(offeringReaders.offeringText(word, "word"), enabled ? word.passages[0].text : null);
    assert.equal(guideOfferingText(word, "word"), enabled ? word.passages[0].text : null);
  }

  const betaBudget = harness([...candidateData(), [POLICY_PATH, policyData(true)]]);
  await Promise.all([betaBudget.handler(), betaBudget.handler(), betaBudget.handler()]);
  await betaBudget.handler();
  assert.equal(betaBudget.calls.length, 10, "beta does not relax concurrency or the daily cap");
  assert.equal(betaBudget.store.get("_system/fieldPassageQueue").attemptedCount, 10);
  assert.equal(betaBudget.store.get("_system/fieldPassageQueue").draftedCount, 10);
  for (const call of betaBudget.calls) {
    assert.match(call.messages.at(-1).content, /^[a-z]+$/);
    assert.doesNotMatch(JSON.stringify(call), /PRIVATE|exemplars|itemCounts|offline\/patterns|email|betaAutoApprove/);
  }
  assert.equal((await betaBudget.__test.queueCounts(betaBudget.db)).pendingCount, 0);

  // Failures consume reservations too; parse/network failures must not
  // silently substitute copy or trigger automatic retry calls.
  const failed = harness(candidateData(), {
    fetch: async (_, index) => {
      if (index % 2) throw new Error("offline network failure");
      return { ok: true, json: async () => ({ choices: [{ message: {
        content: JSON.stringify({ passages: [
          { text: "x", locator: "y" }, { text: "x", locator: "y" }, { text: "x", locator: "y" },
        ] }),
      } }] }) };
    },
  });
  await failed.handler();
  await failed.handler();
  assert.equal(failed.calls.length, 10);
  assert.equal(failed.store.get("_system/fieldPassageQueue").draftedCount, 0);
  assert.equal(failed.store.get("_system/fieldPassageQueue").attemptedCount, 10);

  const http = harness(candidateData(), {
    fetch: async () => ({ ok: false, status: 429 }),
  });
  for (let i = 0; i < 12; i++) await http.handler();
  assert.equal(http.calls.length, 10, "HTTP errors count and repeated runs cannot retry a reserved key");
  assert.equal(new Set(http.calls.map((c) => c.messages.at(-1).content)).size, 10);

  // Allowlist intersection, resistance roots, short keys, ranking, and
  // compatibility copy preservation. No heuristic length filters.
  const eligibility = harness([
    ["practitionerContent/queue_allowlist", { kind: "queue_allowlist", words: ["go", "zeta", "beta", "alpha", "founder", "drafted", "approved", "small"] }],
    ["motifLexicon/fear", { key: "fear", keyType: "resistance", terms: ["fear"] }],
    ["motifLexicon/water", { key: "water", keyType: "motif", terms: ["water"] }],
    ["motifLexicon/proposal", { key: "proposal", keyType: "resistance", terms: ["proposal"], status: "draft" }],
    ["practitionerContent/word_founder", { text: "Founder-selected top-level copy", passages: [] }],
    ["practitionerContent/word_drafted", { passages: [{ status: "draft", text: "draft" }] }],
    ["practitionerContent/word_approved", { passages: [{ status: "approved", text: "approved" }] }],
    ["practitionerContent/motif_water", { text: "Founder water" }],
    ["users/a/patterns/thread", { itemCounts: {
      actually: 999, go: 3, zeta: 100, beta: 4, alpha: 4, founder: 20, drafted: 20, approved: 20, small: 2,
    } }],
    ["users/b/patterns/thread", { itemCounts: { go: 3 } }],
    ["users/a/patterns/resistance", { itemCounts: { fear: 6, proposal: 99 } }],
    ["users/a/patterns/motif", { itemCounts: { water: 100 } }],
    ["elsewhere/a/patterns/thread", { itemCounts: { zeta: 9999 } }],
  ]);
  const candidates = await eligibility.__test.establishedCandidates(eligibility.db);
  assert.equal(candidates.map((c) => `${c.keyType}:${c.key}`).join(","),
    "word:go,word:zeta,resistance:fear,word:alpha,word:beta");
  assert.equal(candidates[0].establishedUsers, 2);
  assert.equal(candidates[0].totalCount, 6);
  eligibility.store.set("practitionerContent/queue_allowlist", { kind: "queue_allowlist", words: ["actually"] });
  assert.equal((await eligibility.__test.establishedCandidates(eligibility.db)).some((c) => c.key === "actually"), true);

  // Direct transactions exercise stale leases, duplicate reservations,
  // founder edits racing a response, and restart safety after a crash.
  const race = harness(candidateData());
  const t = race.__test;
  const lease = await t.acquireDailyLease(race.db);
  const candidate = { keyType: "word", key: "keya" };
  const reserved = await Promise.all([
    t.reserveCandidate(race.db, lease, candidate), t.reserveCandidate(race.db, lease, candidate),
  ]);
  assert.equal(reserved.filter(Boolean).length, 1);
  assert.equal(race.store.get("_system/fieldPassageQueue").attemptedCount, 1);
  race.setNow("2026-07-12T11:07:00Z");
  const replacement = await t.acquireDailyLease(race.db);
  assert.equal(replacement.acquired, true);
  assert.equal(await t.storeDrafts(race.db, lease, candidate, parsed), false, "expired owner cannot publish");
  assert.equal(await t.reserveCandidate(race.db, replacement, candidate), false, "crashed attempt is never rebilled");
  const next = { keyType: "word", key: "keyb" };
  assert.equal(await t.reserveCandidate(race.db, replacement, next), true);
  race.store.set("practitionerContent/word_keyb", { text: "Founder edit during model call" });
  assert.equal(await t.storeDrafts(race.db, replacement, next, parsed), false);
  assert.equal(race.store.get("practitionerContent/word_keyb").text, "Founder edit during model call");
  const third = { keyType: "word", key: "keyc" };
  assert.equal(await t.reserveCandidate(race.db, replacement, third), true);
  assert.equal(await t.storeDrafts(race.db, replacement, third, parsed), true);
  race.store.delete("practitionerContent/word_keyc");
  assert.equal(await t.storeDrafts(race.db, replacement, third, parsed), false, "publication retry cannot restore a deleted draft");
  await assert.rejects(t.storeDrafts(race.db, replacement, third, [...parsed, ...parsed]), /only one/);
  await t.releaseDailyLease(race.db, lease);
  assert.equal(race.store.get("_system/fieldPassageQueue").leaseToken, replacement.token, "stale release cannot unlock new owner");
  race.setNow("2026-07-13T00:00:00Z");
  assert.equal(await t.reserveCandidate(race.db, replacement, { keyType: "word", key: "keyd" }), false);
  assert.equal(await t.storeDrafts(race.db, replacement, next, parsed), false);

  // The shared policy is read in the final transaction, not cached before a
  // model call. Founder selections and rejected content win even in beta.
  const betaRace = harness([...candidateData(), [POLICY_PATH, policyData(true)]]);
  const betaLease = await betaRace.__test.acquireDailyLease(betaRace.db);
  for (const keyType of ["word", "motif", "resistance"]) {
    const item = { keyType, key: "selected" };
    assert.equal(await betaRace.__test.reserveCandidate(betaRace.db, betaLease, item), true);
    const selection = { text: `Founder ${keyType} selection`, passages: [] };
    betaRace.store.set(`practitionerContent/${keyType}_selected`, selection);
    assert.equal(await betaRace.__test.storeDrafts(betaRace.db, betaLease, item, parsed), false);
    assert.equal(betaRace.store.get(`practitionerContent/${keyType}_selected`), selection);
  }
  for (const rejected of [
    { status: "rejected", passages: [] },
    { approval: { status: "rejected" } },
    { passages: [{ status: "rejected", text: "Rejected copy" }] },
  ]) {
    betaRace.store.set("practitionerContent/word_rejected", rejected);
    const item = { keyType: "word", key: "rejected" };
    assert.equal(await betaRace.__test.reserveCandidate(betaRace.db, betaLease, item), false);
    assert.equal(betaRace.store.get("practitionerContent/word_rejected"), rejected);
  }
  const revoked = { keyType: "motif", key: "revoked" };
  assert.equal(await betaRace.__test.reserveCandidate(betaRace.db, betaLease, revoked), true);
  betaRace.store.set(POLICY_PATH, policyData(false));
  assert.equal(await betaRace.__test.storeDrafts(betaRace.db, betaLease, revoked, parsed), true);
  assert.equal(betaRace.store.get("practitionerContent/motif_revoked").passages[0].status, "draft");
  assert.equal(betaRace.store.get("practitionerContent/motif_revoked").text, undefined);
  await assert.rejects(betaRace.__test.storeDrafts(betaRace.db, betaLease, revoked,
    [{ ...parsed[0], status: "approved" }]), /unapproved generated/);

  const approvedHistory = {
    key: "history", keyType: "motif", text: "Existing founder selection",
    passages: Array.from({ length: 273 }, (_, index) => ({
      text: `existing approved ${index}`, locator: "retained", source: "generated", status: "approved",
      createdAt: Date.parse(index < 9 ? "2026-07-12T10:00:00Z" : "2026-07-01T10:00:00Z"),
    })),
  };
  const existingDrafts = {
    key: "review", keyType: "word",
    passages: Array.from({ length: 2 }, (_, index) => ({
      text: `existing draft ${index}`, locator: "retained", source: "generated", status: "draft",
      createdAt: Date.parse("2026-07-01T10:00:00Z"),
    })),
  };
  const legacy = harness([
    ...candidateData(),
    ["practitionerContent/motif_history", approvedHistory],
    ["practitionerContent/word_review", existingDrafts],
    ["_system/fieldPassageQueue", { day: "2026-07-12", draftedCount: 3, attemptedCount: 3 }],
  ]);
  await legacy.handler();
  assert.equal(legacy.calls.length, 1, "legacy three-passage batch accounting migrates conservatively");
  assert.equal(legacy.store.get("_system/fieldPassageQueue").draftedCount, 10);
  assert.equal(legacy.store.get("_system/fieldPassageQueue").attemptedCount, 10);
  await legacy.handler();
  assert.equal(legacy.calls.length, 1, "no further calls after nine legacy passages plus one new passage");
  assert.equal(legacy.store.get("practitionerContent/motif_history"), approvedHistory);
  assert.equal(legacy.store.get("practitionerContent/word_review"), existingDrafts);
  assert.match(legacy.messages[0].message.subject, /3 awaiting you/);
  assert.match(legacy.messages[0].message.text, /10 generated today/);
  console.log("fieldQueue tests passed (offline beta offering policy, server/client usability, daily caps, failures, concurrency, privacy, eligibility, preservation, digest)");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });