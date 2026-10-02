"use strict";

// Offline only: the Admin SDK is replaced before loading the real engine.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Timestamp } = require("firebase-admin/firestore");
const { __test, extractLanguage } = require("./patternEngine");

// Reuse approved seed copy, rather than inventing production-facing wording.
const seeded = JSON.parse(fs.readFileSync(path.join(
  __dirname, "../seed-content/MNRL-seed-content/mineral-content/practitioner-content/offerings.json"
), "utf8"));
const approvedText = seeded[0].passages[0].text;
const approved = { text: approvedText, status: "approved" };
const snap = (data) => ({ exists: data !== undefined, data: () => data });

function requestsFor(built) {
  return __test.offeringRequests(
    built.offeringHits, new Map(Object.keys(built.docs.thread.itemCounts).map((key) => [key, true]))
  );
}

async function run() {
  const language = extractLanguage("Bodies. Burning. Settled. Waves. Glass. Fear.");
  assert.deepEqual([...language.keys()], ["body", "burn", "settl", "wav", "glass", "fear"]);
  const hits = new Map([
    ["Fear", { keyType: "resistance" }],
    [" --Water / Moon-- ", { keyType: "motif" }],
    ["fear", { keyType: "motif" }],
  ]);
  const wanted = __test.offeringRequests(hits, language);
  assert.deepEqual(wanted.map((r) => r.docId), [
    "resistance_fear", "motif_water-moon", "motif_fear",
    "word_body", "word_burn", "word_settl", "word_wav", "word_glass", "word_fear",
  ]);
  assert.equal(
    __test.offeringRequests(new Map(), extractLanguage("Burning bodies near waves"))
      .some((r) => r.key.includes(" ")),
    false, "phrases must not become word lookups"
  );
  assert.equal(__test.offeringRequests(new Map(), extractLanguage("The and actually")).length, 0);

  for (const data of [
    undefined, null, {}, { text: approvedText }, { text: 12 },
    { passages: [] }, { passages: "invalid" }, { passages: {} },
    { passages: [null, {}, { ...approved, status: "draft" }] },
    { passages: [{ ...approved, text: "" }, { ...approved, text: "  " }, { ...approved, text: 12 }] },
    { status: "draft", passages: [approved] },
    { text: approvedText, passages: [{ ...approved, status: "draft" }] },
  ]) {
    assert.equal(__test.offeringText(data, "word"), null);
  }
  assert.equal(__test.offeringText({
    text: "unreviewed compatibility text",
    passages: [
      { text: "draft text", status: "draft" }, null,
      { text: "", status: "approved" }, approved,
      { ...approved, text: ` ${approvedText} ` },
    ],
  }, "word"), approvedText, "first valid approved passage, stored order, verbatim");
  const spaced = ` ${approvedText} `;
  assert.equal(__test.offeringText({ passages: [{ ...approved, text: spaced }] }, "word"), spaced);
  for (const keyType of ["motif", "resistance"]) {
    assert.equal(__test.offeringText({ text: approvedText }, keyType), approvedText);
    assert.equal(__test.offeringText({ text: true }, keyType), null);
    assert.equal(__test.offeringText({ text: "   " }, keyType), null);
    assert.equal(__test.offeringText({ text: approvedText, passages: [] }, keyType), approvedText);
    assert.equal(__test.offeringText({
      text: approvedText, passages: [{ ...approved, status: "draft" }],
    }, keyType), approvedText, "passage metadata must not override founder-selected top-level text");
    assert.equal(__test.offeringText({
      status: "draft", text: approvedText, passages: [approved],
    }, keyType), approvedText, "retain existing top-level-text behavior without a new status policy");
    for (const data of [
      { passages: [approved] },
      { text: "", passages: [approved] },
      { text: "   ", passages: [approved] },
      { text: 12, passages: [approved] },
      { text: null, passages: [approved] },
    ]) {
      assert.equal(__test.offeringText(data, keyType), null,
        "approved passages must never bypass the founder's motif/resistance hero-text choice");
    }
    assert.equal(__test.offeringText({
      text: spaced, passages: [approved, { ...approved, text: spaced }],
    }, keyType), spaced, "preserve an explicitly approved compatibility selection");
  }
  const mapped = __test.offeringsFromSnapshots(wanted, wanted.map(() =>
    snap({ text: approvedText, passages: [approved] })
  ));
  assert.deepEqual(mapped.get("thread:fear"), { key: "fear", text: approvedText });
  assert.deepEqual(mapped.get("motif:fear"), { key: "fear", text: approvedText });
  assert.equal(__test.offeringsFromSnapshots(wanted, []).size, 0);

  const reads = [];
  const loaded = await __test.loadOfferings({
    collection: (name) => {
      assert.equal(name, "practitionerContent");
      return { doc: (id) => ({ get: async () => {
        reads.push(id);
        return snap({ text: approvedText, passages: [approved] });
      } }) };
    },
  }, wanted);
  assert.deepEqual(loaded, mapped);
  assert.deepEqual(reads, wanted.map((r) => r.docId));
  await assert.rejects(__test.loadOfferings({
    collection: () => ({ doc: () => ({ get: async () => { throw new Error("offline read failure"); } }) }),
  }, wanted), /offline read failure/, "read failures must surface, not masquerade as absent copy");

  const revision = (exists, ms) => ({
    exists, ref: { path: "practitionerContent/word_fear" },
    updateTime: Timestamp.fromMillis(ms),
  });
  const fingerprint = (offering) => __test.rebuildInputFingerprint({
    notesSnap: { docs: [] }, motifSnap: { docs: [] },
    consciousnessSnap: { exists: false }, offeringSnaps: [offering],
  });
  assert.equal(__test.sameRebuildInputs(
    fingerprint(revision(false, 1)), fingerprint(revision(true, 2))
  ), false, "new approved word doc invalidates an in-flight missing-doc scan");
  assert.equal(__test.sameRebuildInputs(
    fingerprint(revision(true, 2)), fingerprint(revision(true, 3))
  ), false, "approval/text changes must invalidate an in-flight scan");
  assert.equal(__test.sameRebuildInputs(
    fingerprint(revision(true, 2)), fingerprint(revision(false, 3))
  ), false, "content deletion must invalidate an in-flight scan");

  const notes = ["Fear.", "Fear.", "Fear."].map((content, index) => ({
    id: `n${index}`, content, type: "other", transcriptStatus: "none",
    createdAt: Timestamp.fromMillis(1000 + index),
  }));
  const lexicon = [{ key: "fear", keyType: "resistance", terms: ["fear"] }];
  const built = __test.buildPatternDocs(notes, lexicon, {});
  const baseline = __test.buildPatternDocs(notes, lexicon, {});
  const requests = requestsFor(built);
  const offerings = __test.offeringsFromSnapshots(requests, [
    snap({ text: spaced }), snap({ passages: [approved] }),
  ]);
  __test.attachOfferings(built.docs, requests, offerings);
  assert.deepEqual(built.docs.thread.offerings.fear, { key: "fear", text: approvedText });
  assert.deepEqual(built.docs.resistance.offerings.fear, { key: "fear", text: spaced });
  assert.deepEqual(built.docs.motif.offerings, {});
  for (const type of Object.keys(built.docs)) {
    assert.deepEqual({ ...built.docs[type], offerings: {} }, baseline.docs[type],
      "copy must not alter counts, exemplars, note sets, ledger, hygiene, or detection");
  }
  const empty = __test.buildPatternDocs([
    { ...notes[0], content: "" },
    { ...notes[1], content: "fear", transcriptStatus: "pending" },
    { ...notes[2], content: null },
  ], lexicon, {});
  assert.deepEqual(requestsFor(empty), [], "no requests from missing, invalid, or in-flight evidence");
  const gate = __test.emptyPatternDoc("thread");
  __test.attachOfferings({ thread: gate }, requests, offerings);
  assert.deepEqual(gate.offerings, {}, "approved wording alone never creates an item");

  // Run real server entry paths against an in-memory Firestore double.
  // No network, credentials, account lookup, or live writes are possible.
  const store = new Map([
    ["users/offline/fieldNotes/n0", notes[0]],
    ["practitionerContent/word_fear", { passages: [approved] }],
    ["practitionerContent/resistance_fear", { text: spaced }],
    ["motifLexicon/fear", lexicon[0]],
  ]);
  const dbReads = [];
  const snapshot = (p) => ({
    id: p.split("/").at(-1), ref: reference(p), ...snap(store.get(p)),
    updateTime: Timestamp.fromMillis(123),
  });
  function reference(p) {
    return {
      path: p, collection: (name) => collection(`${p}/${name}`),
      get: async () => { dbReads.push(p); return snapshot(p); },
    };
  }
  function collection(p) {
    return {
      path: p, doc: (id) => reference(`${p}/${id}`),
      get: async () => {
        const docs = [...store.keys()]
          .filter((key) => key.startsWith(`${p}/`) && !key.slice(p.length + 1).includes("/"))
          .map(snapshot);
        return { docs, size: docs.length };
      },
    };
  }
  const db = {
    doc: reference, collection,
    runTransaction: async (callback) => callback({
      get: (ref) => ref.get(),
      set: (ref, value, options) => store.set(
        ref.path, options?.merge ? { ...store.get(ref.path), ...value } : value
      ),
      delete: (ref) => store.delete(ref.path),
    }),
  };
  const sandbox = {
    module: { exports: {} }, setTimeout, Buffer,
    require: (name) => {
      assert.equal(name, "firebase-admin/firestore");
      return { Timestamp, getFirestore: () => db };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "patternEngine.js"), "utf8"), sandbox);
  const engine = sandbox.module.exports;
  await engine.updatePatternsForNote("offline", "n0", notes[0], "add");
  assert.equal(store.get("users/offline/patterns/thread").offerings.fear.text, approvedText);
  assert.equal(store.get("users/offline/patterns/resistance").offerings.fear.text, spaced);
  const beforeRepeat = JSON.stringify(store.get("users/offline/patterns/thread"));
  await engine.updatePatternsForNote("offline", "n0", notes[0], "add");
  assert.equal(JSON.stringify(store.get("users/offline/patterns/thread")), beforeRepeat);
  const readsBeforeRemove = dbReads.filter((p) => p.includes("practitionerContent/word_")).length;
  await engine.updatePatternsForNote("offline", "n0", notes[0], "remove");
  assert.equal(store.get("users/offline/patterns/thread").offerings.fear, undefined);
  assert.equal(dbReads.filter((p) => p.includes("practitionerContent/word_")).length, readsBeforeRemove);
  await engine.rebuildPatternsForUser("offline");
  assert.equal(store.get("users/offline/patterns/thread").offerings.fear.text, approvedText);
  assert.equal(dbReads.filter((p) => p === "practitionerContent/word_fear").length >= 2, true,
    "word content must be read outside and inside the fenced publish transaction");
  store.set("practitionerContent/word_fear", { passages: [{ ...approved, status: "draft" }] });
  await engine.backfillPatternsForUser("offline", { fullRebuild: true });
  assert.equal(store.get("users/offline/patterns/thread").offerings.fear, undefined,
    "full rebuild removes stale copy after approval is withdrawn");

  // Execute the actual unchanged Guide pooling/order functions (not replicas).
  // TypeScript is an existing workspace devDependency, never a server dependency.
  const ts = require("typescript");
  function evaluateTs(source) {
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const context = { exports: {} };
    vm.runInNewContext(output, context);
    return context;
  }
  const guideSource = fs.readFileSync(path.join(__dirname, "../artifacts/mineral/app/(tabs)/guide.tsx"), "utf8");
  const guide = evaluateTs(guideSource.slice(
    guideSource.indexOf("function poolItems("), guideSource.indexOf("/** Age phrase")
  ));
  const textHelpers = evaluateTs(fs.readFileSync(path.join(
    __dirname, "../artifacts/mineral/lib/patternText.ts"
  ), "utf8")).exports;
  const pooled = guide.poolItems({ thread: built.docs.thread });
  const itemNotes = Object.fromEntries(pooled.map((item) => [item.key, item.noteIds]));
  const visible = textHelpers.suppressForDisplay(pooled, itemNotes);
  const hero = visible.filter((item) => item.count >= 3).sort(guide.heroFreshnessOrder)[0];
  assert.equal(hero.type, "thread");
  assert.equal(hero.key, "fear");
  assert.equal(built.docs[hero.type].offerings[hero.key].text, approvedText);
  assert.equal(guide.poolItems(built.docs).find((item) => item.key === "fear").type, "resistance",
    "Guide must continue preferring a lexicon entry over a duplicate thread");
  const listenerModule = evaluateTs(fs.readFileSync(path.join(
    __dirname, "../artifacts/mineral/lib/patternEvidenceState.ts"
  ), "utf8")).exports;
  const emitted = [];
  const listener = new listenerModule.PatternEvidenceListenerState((docs) => emitted.push(docs));
  const stored = __test.splitPatternEvidenceForStorage(
    "thread", "users/offline/patterns/thread", built.docs.thread, 42, Timestamp.now()
  );
  listener.receiveRoots({ thread: stored.root });
  listener.receivePages("motif", []);
  listener.receivePages("resistance", []);
  assert.equal(emitted.length, 0, "Guide does not render before evidence listeners are coherent");
  listener.receivePages("thread", stored.pages.map((page) => page.data));
  const received = emitted.at(-1);
  assert.equal(received.thread.offerings.fear.text, approvedText);
  const receivedHero = guide.poolItems(received).sort(guide.heroFreshnessOrder)[0];
  assert.equal(received[receivedHero.type].offerings[receivedHero.key].text, approvedText,
    "actual Guide listener preserves the root offering and its lookup key");
  assert.match(guideSource, /heroOffering\?\.text[\s\S]*testID="hero-offering"/);
  const liveResolver = evaluateTs(fs.readFileSync(path.join(
    __dirname, "../artifacts/mineral/lib/guideOfferings.ts"
  ), "utf8")).exports;
  const target = liveResolver.guideOfferingTarget(receivedHero);
  assert.equal(target.docId, "word_fear", "live lookup uses the selected engine key");
  assert.equal(target.keyType, "word");
  assert.equal(liveResolver.guideOfferingTarget({ type: "thread", key: "return" }).docId,
    "word_return", "already-stemmed return is never re-stemmed");
  assert.equal(liveResolver.guideOfferingTarget({ type: "thread", key: "unknown phrase" }), null,
    "unsupported phrase cannot borrow another word's copy");
  for (const keyType of ["word", "motif", "resistance"]) {
    for (const content of [
      null,
      { text: approvedText },
      { text: approvedText, passages: [approved] },
      { text: spaced, passages: [approved, { ...approved, text: spaced }] },
      { text: approvedText, passages: [{ ...approved, status: "draft" }] },
      { status: "draft", text: approvedText, passages: [approved] },
    ]) {
      assert.equal(liveResolver.guideOfferingText(content, keyType),
        __test.offeringText(content, keyType), `live ${keyType} approval mirrors server`);
    }
  }
  let hydration = null;
  const receiver = liveResolver.guideOfferingReceiver(target, (next) => { hydration = next; });
  receiver.receive({ passages: [approved] });
  assert.equal(liveResolver.guideOfferingText(
    liveResolver.currentGuideOfferingContent(target, hydration), target.keyType
  ), approvedText);
  receiver.receive(null);
  assert.equal(liveResolver.currentGuideOfferingContent(target, hydration), null,
    "a missing live document does not preserve the still-present cached root offering");
  receiver.close();
  receiver.receive({ passages: [approved] });
  assert.equal(liveResolver.currentGuideOfferingContent(target, hydration), null,
    "late callbacks cannot resurrect withdrawn copy");
  assert.match(guideSource, /currentGuideOfferingContent\(heroOfferingTarget, heroHydration\)/);
  assert.match(guideSource, /guideOfferingText\(heroContent, heroOfferingTarget\.keyType\)/);
  assert.match(guideSource, /fsDoc\(db, "practitionerContent", heroOfferingTarget\.docId\)/);
  assert.match(guideSource, /const heroOfferingTarget = useMemo\([\s\S]*?\[hero\?\.key, hero\?\.type, user\?\.uid\]/,
    "target identity is stable across ordinary hero object re-renders");
  assert.match(guideSource, /}, \[heroOfferingTarget\]\)/,
    "live subscription depends on the memoized target, not the recreated hero object");
  console.log("pattern offering tests passed (offline server paths + live Guide approval boundary)");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });