"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { countPassageQueue } = require("./fieldQueue");
const { passageQueue } = require("./founderDigest");

const NOW = Date.parse("2026-07-12T12:00:00Z");
const snapshot = (entries) => ({
  docs: entries.map((data) => ({ data: () => data })),
});
const generated = (ms, status = "draft") => ({
  source: "generated", status, text: "offline count fixture",
  createdAt: { toMillis: () => ms },
});

async function run() {
  const docs = snapshot([
    { kind: "offering", key: "retained", passages: [
      generated(NOW - 25 * 60 * 60 * 1000, "approved"),
      generated(NOW - 13 * 60 * 60 * 1000, "approved"), // Yesterday, within 24h.
      generated(NOW - 60 * 60 * 1000, "approved"),
      generated(NOW - 60 * 60 * 1000, "draft"),
      generated(NOW + 60 * 60 * 1000, "approved"), // Future timestamps don't count.
      { source: "founder", status: "approved", createdAt: NOW },
      { source: "generated", status: "approved" }, // Missing date doesn't count.
    ] },
    { passages: [{ status: "draft", source: "founder" }] }, // Missing key still counts pending.
    { kind: "queue_allowlist", words: [] },
    { kind: "passage_prompt", text: "shared" },
  ]);
  const totals = countPassageQueue(docs, NOW);
  assert.deepEqual(totals, {
    pendingCount: 2, generatedPast24hCount: 3, generatedTodayCount: 2,
    keys: ["retained"], notRunning: false,
  });
  assert.equal(countPassageQueue(snapshot([]), NOW).notRunning, true);
  const boundaries = countPassageQueue(snapshot([{ passages: [
    generated(NOW - 24 * 60 * 60 * 1000, "approved"),
    generated(Date.parse("2026-07-12T00:00:00Z"), "approved"),
    generated(NOW, "approved"),
  ] }]), NOW);
  assert.equal(boundaries.generatedPast24hCount, 3);
  assert.equal(boundaries.generatedTodayCount, 2);
  await assert.rejects(passageQueue({
    collection: () => ({ get: async () => { throw new Error("offline read failure"); } }),
  }, NOW), /offline read failure/);

  const mails = [];
  const query = (name) => ({
    where: () => query(name),
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
    get: async () => name === "practitionerContent" ? docs : { docs: [], size: 0 },
  });
  const db = {
    collection: query,
    collectionGroup: () => ({ get: async () => ({ docs: [], size: 0 }) }),
    doc: (p) => ({ create: async (mail) => { assert.match(p, /^mail\/founder-digest-/); mails.push(mail); } }),
  };
  assert.deepEqual(await passageQueue(db, NOW), { ...totals, count: 2 });
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
  }
  const context = {
    module: { exports: {} }, Date: Clock, Intl, console,
    require: (name) => {
      if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_, callback) => callback };
      if (name === "./fieldQueue") return { countPassageQueue };
      assert.equal(name, "firebase-admin/firestore");
      return { Timestamp: { fromMillis: (ms) => ms }, FieldValue: { serverTimestamp: () => NOW } };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "founderDigest.js"), "utf8"), context);
  const handler = context.module.exports.createFounderDigest({
    db, auth: { listUsers: async () => ({ users: [] }) },
    founderEmail: { value: () => "offline@example.invalid" },
  });
  await handler();
  assert.equal(mails.length, 1);
  assert.match(mails[0].message.subject, /2 awaiting you/);
  assert.match(mails[0].message.text, /2 pending passages total: retained/);
  assert.match(mails[0].message.text, /3 generated in the past 24h · 2 generated today \(UTC\)/);

  // Evaluate seed module without SDK access: only call the create-only helper.
  const seedPath = path.join(__dirname, "../seed-content/MNRL-seed-content/seed/seed-content.js");
  const seedContext = {
    module: { exports: {} }, __dirname: path.dirname(seedPath), console,
    require: (name) => {
      if (name === "firebase-admin") return {};
      if (name === "fs") return fs;
      if (name === "path") return path;
      throw new Error(`unexpected seed import ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(seedPath, "utf8"), seedContext);
  const seed = seedContext.module.exports.seedQueueAllowlist;
  let value;
  const existingFounderList = { kind: "queue_allowlist", words: ["flow"] };
  const seedDb = {
    collection: (name) => {
      assert.equal(name, "practitionerContent");
      return { doc: (id) => {
        assert.equal(id, "queue_allowlist");
        return { create: async (entry) => {
          if (value) throw Object.assign(new Error("already exists"), { code: 6 });
          value = entry;
        } };
      } };
    },
  };
  await seed(seedDb);
  assert.equal(value.kind, "queue_allowlist");
  assert.equal(value.words.length, 0);
  value = existingFounderList;
  await seed(seedDb);
  assert.equal(value, existingFounderList, "rerun must never overwrite live founder vocabulary");
  await assert.rejects(seed({
    collection: () => ({ doc: () => ({ create: async () => {
      throw new Error("offline permission failure");
    } }) }),
  }), /offline permission failure/);
  console.log("founderDigest tests passed (actual passage counts, approval-independent generation dates, daily digest, atomic create-only seed)");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });