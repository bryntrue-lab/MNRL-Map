import assert from "node:assert/strict";

import { PatternEvidenceListenerState } from "./patternEvidenceState.ts";

const exemplar = (fieldNoteId) => ({ fieldNoteId });
const root = (generation, fieldNoteId = "newest") => ({
  thread: {
    evidenceGeneration: generation,
    evidencePageCount: 1,
    exemplars: { river: [exemplar(fieldNoteId)] },
  },
});
const page = (generation, fieldNoteId = "older") => ({
  evidenceGeneration: generation,
  pageIndex: 0,
  exemplars: { river: [exemplar(fieldNoteId)] },
});

function ready(state) {
  state.receivePages("motif", []);
  state.receivePages("resistance", []);
}

// Root-first: no partial root is emitted before all page listeners arrive.
{
  const outputs = [];
  const state = new PatternEvidenceListenerState((value) => outputs.push(value));
  state.receiveRoots(root(7));
  assert.equal(outputs.length, 0);
  ready(state);
  assert.equal(outputs.length, 0);
  state.receivePages("thread", [page(7)]);
  assert.deepEqual(
    outputs.at(-1).thread.exemplars.river.map((entry) => entry.fieldNoteId),
    ["older", "newest"]
  );
}

// Page-first cached data is accepted once its matching root arrives.
{
  const outputs = [];
  const state = new PatternEvidenceListenerState((value) => outputs.push(value));
  ready(state);
  state.receivePages("thread", [page(7)]);
  assert.equal(outputs.length, 0);
  state.receiveRoots(root(7));
  assert.deepEqual(
    outputs.at(-1).thread.exemplars.river.map((entry) => entry.fieldNoteId),
    ["older", "newest"]
  );
}

// A new root never joins cached pages from the prior generation.
{
  const outputs = [];
  const state = new PatternEvidenceListenerState((value) => outputs.push(value));
  ready(state);
  state.receivePages("thread", [page(7)]);
  state.receiveRoots(root(7));
  const coherentCount = outputs.length;
  state.receiveRoots(root(8, "newest-8"));
  assert.equal(outputs.length, coherentCount);
  state.receivePages("thread", [page(7, "cached-7")]);
  assert.equal(outputs.length, coherentCount);
  state.receivePages("thread", [page(8, "older-8")]);
  assert.deepEqual(
    outputs.at(-1).thread.exemplars.river.map((entry) => entry.fieldNoteId),
    ["older-8", "newest-8"]
  );
}

// Terminal error clearing is final: later cached callbacks cannot resurrect
// stale evidence after the adapter has stopped all Firestore listeners.
{
  const outputs = [];
  const state = new PatternEvidenceListenerState((value) => outputs.push(value));
  ready(state);
  state.receivePages("thread", [page(7)]);
  state.receiveRoots(root(7));
  state.fail();
  assert.deepEqual(outputs.at(-1), {});
  const countAfterFailure = outputs.length;
  state.receiveRoots(root(8));
  state.receivePages("thread", [page(8)]);
  assert.equal(outputs.length, countAfterFailure);
}

console.log("pattern evidence listener state tests passed");