"use strict";

const assert = require("node:assert/strict");
const {
  STOPWORDS,
  deriveConditionsPattern,
  deriveConsciousnessPattern,
  extractLanguage,
  generationDisposition,
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

console.log("patternEngine Slice K tests passed");