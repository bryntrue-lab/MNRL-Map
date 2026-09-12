"use strict";

const assert = require("node:assert/strict");
const { phraseHygiene: legacyPhraseHygiene } = require("./tests/fixtures/legacyPhraseHygiene");
const {
  STOPWORDS,
  deriveConditionsPattern,
  deriveConsciousnessPattern,
  extractLanguage,
  generationDisposition,
  __test,
} = require("./patternEngine");

const at = (iso) => new Date(iso);
const note = (id, type, iso, extra = {}) => ({
  id,
  type,
  createdAt: at(iso),
  captureMode: "text",
  transcriptStatus: "none",
  source: "spontaneous",
  content: "plain words",
  ...extra,
});

// Hour evidence: three matching resistance notes among four hour-carrying
// notes. Missing context must not be smuggled into its denominator.
const hourPattern = deriveConditionsPattern([
  note("a", "resistance", "2026-01-01T22:00:00Z", { localHour: 22 }),
  note("b", "resistance", "2026-01-01T22:10:00Z", { localHour: 22 }),
  note("c", "resistance", "2026-01-02T22:00:00Z", { localHour: 22 }),
  note("d", "resistance", "2026-01-02T12:00:00Z", { localHour: 12 }),
  note("missing", "resistance", "2026-01-02T12:10:00Z"),
]);
assert.deepEqual(hourPattern.findings, [{
  kind: "hour",
  type: "resistance",
  bucket: "night",
  matchingCount: 3,
  totalWithHour: 4,
}]);

// Two matching notes never create an hour finding, even when their fraction
// is otherwise strong.
assert.equal(
  deriveConditionsPattern([
    note("a", "resistance", "2026-01-01T22:00:00Z", { localHour: 22 }),
    note("b", "resistance", "2026-01-01T22:10:00Z", { localHour: 22 }),
    note("c", "resistance", "2026-01-02T12:00:00Z", { localHour: 12 }),
  ]).detectedFindings.length,
  0
);

const gapPattern = deriveConditionsPattern([
  note("d1", "dream", "2026-02-03T08:00:00Z"),
  note("d2", "dream", "2026-02-03T09:00:00Z"),
  note("d3", "dream", "2026-02-03T10:00:00Z"),
]);
assert.deepEqual(gapPattern.findings, [{
  kind: "gap",
  type: "dream",
  matchingCount: 3,
  totalQualifying: 3,
}]);

// `firstNoteAt` is the minimum across the rebuild's complete dated-note scan,
// not the number of active days. A sparse field therefore keeps the Guide's
// elapsed inclusive span available to privacy-bound server consumers.
const sparseDates = deriveConditionsPattern([
  note("first", "dream", "2026-01-01T08:00:00Z"),
  note("later", "symbol", "2026-02-10T08:00:00Z"),
]);
assert.equal(sparseDates.daysRead, 2);
assert.equal(sparseDates.firstNoteAt.toISOString(), "2026-01-01T08:00:00.000Z");

// A tied gap leader is detected neither as a rendered nor internal gap claim.
const tiedGap = deriveConditionsPattern([
  note("a", "dream", "2026-02-03T08:00:00Z"),
  note("b", "dream", "2026-02-03T09:00:00Z"),
  note("c", "symbol", "2026-02-03T10:00:00Z"),
  note("d", "symbol", "2026-02-03T11:00:00Z"),
]);
assert.equal(tiedGap.detectedFindings.some((finding) => finding.kind === "gap"), false);

const families = {
  magic: ["ritual"],
  mythic: ["story"],
  mental: ["plan"],
  integral: ["whole"],
};
const consciousness = deriveConsciousnessPattern([
  note("magic-old", "other", "2026-03-01T10:00:00Z", { content: "a ritual" }),
  note("mental-old", "other", "2026-03-02T10:00:00Z", { content: "a plan" }),
  note("magic-new", "other", "2026-03-03T10:00:00Z", { content: "another ritual" }),
  note("mental-new", "other", "2026-03-04T10:00:00Z", { content: "another plan" }),
], families);
assert.equal(consciousness.leading, "mental");
assert.equal(consciousness.exemplar.fieldNoteId, "mental-new");
assert.deepEqual(consciousness.structureCounts, {
  magic: 2,
  mythic: 0,
  mental: 2,
  integral: 0,
});

// A changed family changes the next rebuild's result without a code change.
assert.equal(
  deriveConsciousnessPattern(
    [note("changed", "other", "2026-03-05T10:00:00Z", { content: "a bell" })],
    { magic: ["bell"], mythic: [], mental: [], integral: [] }
  ).leading,
  "magic"
);
assert.equal(
  deriveConsciousnessPattern(
    [note("legacy-shape", "other", "2026-03-06T10:00:00Z", { content: "a bell" })],
    { magic: ["bell"], mythic: [], mental: [], integral: [] }
  ).structureCounts.magic,
  1
);

for (const filler of ["though", "exactly", "sure", "actually", "almost", "along", "already", "another", "anyway", "really", "maybe", "quite", "rather", "perhaps", "especially"]) {
  assert.equal(STOPWORDS.has(filler), true, `${filler} must be a stopword`);
  assert.equal(extractLanguage(filler).has(filler), false, `${filler} must not be extracted`);
}
assert.equal(
  [...extractLanguage("exactly manifest goals").keys()].some((item) => item.includes("exactly")),
  false,
  "fillers must not survive inside a gathering phrase"
);
assert.equal(extractLanguage("manifest goals toward").has("manifest"), true);
assert.equal(extractLanguage("manifest goals toward").has("goal"), true);
assert.equal(extractLanguage("manifest goals toward").has("toward"), true);

// Mock integration interleaving: a create event claims generation one, then
// a callable claims generation two and fails before it can publish. The older
// event must reject for Eventarc retry — it cannot report a successful
// coalescence into an uncommitted dirty state. Its retry then claims and
// commits generation three; only after that is the original event allowed to
// coalesce.
const generationStore = { requestedGeneration: 1, committedGeneration: 0 };
generationStore.requestedGeneration = 2; // newer callable claim
assert.throws(
  () => generationDisposition(generationStore, 1),
  (error) => error?.code === "aborted" && error?.retryable === true,
  "an older create event must retry when a newer callable fails"
);
generationStore.requestedGeneration = 3; // retried event claim after callable failure
assert.equal(generationDisposition(generationStore, 3), "commit");
generationStore.committedGeneration = 3; // create/edit/delete state has published
assert.equal(generationDisposition(generationStore, 1), "coalesced");

// The indexed hygiene path must remain exactly equivalent to the original
// pairwise semantics, including the full exemplar-coverage merge gate.
function clone(value) {
  return structuredClone(value);
}

function comparable(value) {
  return JSON.parse(JSON.stringify(value));
}

function legacyBuildThreadDoc(noteRecords) {
  const doc = __test.emptyPatternDoc("thread");
  const readable = noteRecords
    .filter(
      (entry) =>
        typeof entry.content === "string" &&
        entry.content.trim().length > 0 &&
        entry.transcriptStatus !== "pending" &&
        entry.transcriptStatus !== "processing"
    )
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  for (const entry of readable) {
    const language = extractLanguage(entry.content);
    if (!language.size) continue;
    __test.applyAdd(doc, language, entry.id, entry);
    legacyPhraseHygiene(doc);
  }
  return doc;
}

function phraseEntry(notes, text) {
  return {
    count: notes.length,
    notes,
    exemplars: notes.map((fieldNoteId, index) => ({
      fieldNoteId,
      text,
      capturedAt: index + 1,
    })),
  };
}

function phraseDoc(entries) {
  const doc = __test.emptyPatternDoc("thread");
  for (const [key, entry] of Object.entries(entries)) {
    doc.itemCounts[key] = entry.count;
    doc.itemNotes[key] = entry.notes;
    doc.exemplars[key] = entry.exemplars;
  }
  return doc;
}

const phraseFixture = phraseDoc({
  "still water": phraseEntry(["a", "b"], "still water rises near shore"),
  "still water rise": phraseEntry(["a", "b"], "still water rises near shore"),
  "water rise near": phraseEntry(["a", "b"], "still water rises near shore"),
  "rise near shore": phraseEntry(["a", "b"], "still water rises near shore"),
  "other water": phraseEntry(["c", "d"], "other water remains"),
  "water remain": phraseEntry(["c", "d"], "other water remains"),
  "single water": phraseEntry(["e"], "single water returns"),
  "water returns": phraseEntry(["e"], "single water returns"),
});
const expectedPhraseDoc = clone(phraseFixture);
legacyPhraseHygiene(expectedPhraseDoc);
const indexedPhraseDoc = clone(phraseFixture);
__test.phraseHygiene(indexedPhraseDoc);
assert.deepEqual(
  comparable(indexedPhraseDoc),
  comparable(expectedPhraseDoc),
  "indexed hygiene must match pairwise reference"
);

// Regression from the production-sized shape that exposed traversal-order
// sensitivity: both engines must retain exactly the legacy thread document.
const mutationOrderNotes = [
  "moon near opens path quiet. bird circle deep ember forest",
  "opens path quiet river. bird circle deep",
  "luminous moon near opens path quiet river stone. deep ember forest green hollow. joins keeps luminous",
  "forest green hollow island. amber bird circle deep ember forest. opens path quiet river",
  "bird circle deep ember forest. quiet river stone turns",
].map((content, index) =>
  note(`id${index}`, "other", `2026-01-01T00:00:0${index}Z`, { content })
);
const legacyMutationOrder = legacyBuildThreadDoc(mutationOrderNotes);
const indexedMutationOrder = __test.buildPatternDocs(mutationOrderNotes, [], {}).docs.thread;
assert.equal(legacyMutationOrder.itemCounts["deep ember forest"], 4);
assert.equal(legacyMutationOrder.itemCounts["bird circle deep ember"], undefined);
assert.deepEqual(
  comparable(indexedMutationOrder),
  comparable(legacyMutationOrder),
  "indexed traversal must preserve pairwise mutation order"
);

// Generated overlapping sequences exercise different insertion and merge
// orders against the exact checked-out legacy implementation.
for (let seed = 0; seed < 16; seed++) {
  const generated = Array.from({ length: 5 }, (_, index) => {
    const tail = ["quartz", "willow", "cinder", "harbor", "lantern"][(seed + index) % 5];
    const content = [
      `orbit ember forest ${tail}.`,
      index % 2 ? "bird circle deep ember forest." : "deep ember forest green hollow.",
      index % 3 ? "quiet river stone turns." : "moon near opens path quiet river.",
    ].join(" ");
    return note(`generated-${seed}-${index}`, "other", `2026-02-01T00:00:0${index}Z`, { content });
  });
  assert.deepEqual(
    comparable(__test.buildPatternDocs(generated, [], {}).docs.thread),
    comparable(legacyBuildThreadDoc(generated)),
    `indexed hygiene must equal legacy for generated sequence ${seed}`
  );
}

// Storage overflow keeps the old root shape valid: all counts, note sets,
// ledgers, offerings, and the newest exemplar survive on the root. Earlier
// capped exemplars are preserved in bounded owner-readable evidence pages.
const storageFixture = __test.emptyPatternDoc("thread");
storageFixture.processed = Array.from({ length: 100 }, (_, index) => `ledger-${index}`);
for (let index = 0; index < 1200; index++) {
  const key = `synthetic pattern ${index}`;
  storageFixture.itemCounts[key] = 3;
  storageFixture.itemNotes[key] = [`note-${index}-a`, `note-${index}-b`, `note-${index}-c`];
  storageFixture.exemplars[key] = Array.from({ length: 3 }, (_, exemplarIndex) => ({
    fieldNoteId: `evidence-${index}-${exemplarIndex}`,
    text: "verbatim evidence ".repeat(18),
    noteType: "other",
    source: "spontaneous",
    encounterRef: null,
    capturedAt: exemplarIndex,
  }));
}
storageFixture.offerings["synthetic pattern 0"] = { key: "synthetic pattern 0", text: "held line" };
const storedThread = __test.splitPatternEvidenceForStorage(
  "thread",
  "users/test-user/patterns/thread",
  storageFixture,
  7,
  new Date("2026-01-01T00:00:00Z")
);
assert.deepEqual(storedThread.root.itemCounts, storageFixture.itemCounts);
assert.deepEqual(storedThread.root.itemNotes, storageFixture.itemNotes);
assert.deepEqual(storedThread.root.offerings, storageFixture.offerings);
assert.deepEqual(storedThread.root.processed, storageFixture.processed);
assert.equal(
  storedThread.root.exemplars["synthetic pattern 0"][0].fieldNoteId,
  storageFixture.exemplars["synthetic pattern 0"][2].fieldNoteId
);
assert.deepEqual(
  storedThread.root.exemplars["synthetic pattern 0"],
  storageFixture.exemplars["synthetic pattern 0"].slice(-1),
  "an older root-only reader retains the newest valid capped-exemplar subset"
);
assert.ok(
  __test.firestoreDocumentBytes("users/test-user/patterns/thread", storageFixture) > 1048576,
  "fixture must exercise the former oversized root shape"
);
assert.ok(
  __test.firestoreDocumentBytes("users/test-user/patterns/thread", storedThread.root) < 1000 * 1024,
  "primary root must fit the Firestore safety budget"
);
for (const page of storedThread.pages) {
  assert.equal(page.data.evidenceGeneration, 7);
  assert.equal(page.data.updatedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.ok(
    __test.firestoreDocumentBytes(
      `users/test-user/patterns/thread/evidence/${page.id}`,
      page.data
    ) < 700 * 1024,
    "every evidence page must fit its conservative budget"
  );
}
const rehydratedThread = __test.hydratePatternEvidence(
  storedThread.root,
  storedThread.pages.map((page) => page.data)
);
assert.deepEqual(rehydratedThread.itemCounts, storageFixture.itemCounts);
assert.deepEqual(rehydratedThread.itemNotes, storageFixture.itemNotes);
assert.deepEqual(rehydratedThread.processed, storageFixture.processed);
assert.deepEqual(rehydratedThread.offerings, storageFixture.offerings);
assert.deepEqual(
  rehydratedThread.exemplars,
  storageFixture.exemplars,
  "root plus overflow pages must rehydrate the complete original capped evidence set"
);
assert.equal(
  __test.firestoreDocumentBytes("users/a/patterns/thread", {
    text: "hi",
    count: 2,
    enabled: true,
    when: { toMillis: () => 0 },
    none: null,
    array: ["x", 1],
    map: { x: "y" },
  }),
  174,
  "Firestore byte estimator must follow documented name, field, map, and value sizes"
);

// A same-size snapshot whose note revision changed is not fresh. This guards
// against the old predicate-only/count-only commit weakness.
const snapshot = (id, revision, path = `users/test/${id}`) => ({
  id,
  exists: true,
  updateTime: { toMillis: () => revision, nanoseconds: revision % 1000 },
  ref: { path },
});
const inputBefore = {
  notesSnap: { docs: [snapshot("a", 10), snapshot("b", 20)] },
  motifSnap: { docs: [snapshot("m", 30)] },
  consciousnessSnap: snapshot("consciousness_lexicon", 40, "practitionerContent/consciousness_lexicon"),
  offeringSnaps: [snapshot("motif_water", 50, "practitionerContent/motif_water")],
};
const inputAfterChangedNote = {
  ...inputBefore,
  notesSnap: { docs: [snapshot("a", 11), snapshot("b", 20)] },
};
const unchangedLatestInput = {
  notesSnap: { docs: [snapshot("a", 10), snapshot("b", 20)] },
  motifSnap: { docs: [snapshot("m", 30)] },
  consciousnessSnap: snapshot("consciousness_lexicon", 40, "practitionerContent/consciousness_lexicon"),
  offeringSnaps: [snapshot("motif_water", 50, "practitionerContent/motif_water")],
};
assert.equal(
  __test.sameRebuildInputs(
    __test.rebuildInputFingerprint(inputBefore),
    __test.rebuildInputFingerprint(inputAfterChangedNote)
  ),
  false,
  "a latest snapshot with the same note ids/count but a changed revision must not commit"
);
assert.equal(
  __test.sameRebuildInputs(
    __test.rebuildInputFingerprint(inputBefore),
    __test.rebuildInputFingerprint(unchangedLatestInput)
  ),
  true,
  "an unchanged latest snapshot may commit"
);

console.log("patternEngine Slice K tests passed");