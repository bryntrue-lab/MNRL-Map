// Reuse the native-boundary harness without running the encounter/Guide suite.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const harnessSource = fs.readFileSync(path.join(__dirname, "build14Client.test.cjs"), "utf8");
const helpers = { exports: {} };
vm.runInNewContext(
  harnessSource.slice(0, harnessSource.indexOf("\nfunction encounter(")).replace(
    "useMemo(fn) { return fn(); },",
    `useMemo(fn, deps) {
      const i = cursor++;
      const old = hooks[i];
      if (old && deps?.every((value, j) => Object.is(value, old.deps[j]))) return old.value;
      const value = fn();
      hooks[i] = { deps, value };
      return value;
    },`
  ) +
    "\nmodule.exports = { componentHarness, text, tick, deferred, load };",
  { require, module: helpers, __dirname, console }
);
const { componentHarness, text, tick, deferred, load } = helpers.exports;
const patternText = load("lib/patternText.ts", () => { throw Error("unexpected import"); });

function lensHarness(initialLens = "conditions") {
  let lens = initialLens;
  let user = { uid: "isolated-owner" };
  const teachings = [];
  const patterns = [];
  const notes = [];
  const h = componentHarness("app/lens/[lens].tsx", { imports: {
    "expo-router": { router: { back() {} }, useLocalSearchParams: () => ({ lens }) },
    "firebase/firestore": {
      doc: (_db, ...parts) => parts.join("/"),
      getDoc: (ref) => {
        const read = deferred();
        teachings.push({ ref, ...read });
        return read.promise;
      },
      onSnapshot: (query, onData, onError) => {
        const listener = { query, onData, onError, stopped: false };
        notes.push(listener);
        return () => { listener.stopped = true; };
      },
    },
    "@/context/AuthContext": { useAuth: () => ({ user }) },
    "@/context/UserContext": { useUser: () => ({ profile: null }) },
    "@/lib/fieldPassages": { firstApprovedFieldPassage: () => null },
    "@/lib/firestore": { fieldNotesQuery: (uid) => ({ uid, orderBy: "createdAt desc" }) },
    "@/lib/patternEvidence": { subscribePatternDocuments: (uid, onData, onError, types) => {
      const listener = { uid, onData, onError, types, stopped: false };
      patterns.push(listener);
      return () => { listener.stopped = true; };
    } },
    "@/lib/patternText": patternText,
    "@/lib/spiral": {},
  } });
  h.render();
  return { h, teachings, patterns, notes,
    route(next) { lens = next; h.render(); },
    auth(next) { user = next; h.render(); },
  };
}
const teaching = (heldLine) => ({
  exists: () => true,
  data: () => ({ kind: "teaching", heldLine, paragraphs: ["isolated teaching closing"] }),
});

test("conditions use only conditions evidence and approved findings, never detected-only copy", () => {
  const { h, patterns } = lensHarness(["conditions"]);
  assert.deepEqual(Array.from(patterns[0].types), ["conditions"]);
  patterns[0].onData({ conditions: {
    notesRead: 53, daysRead: 22,
    findings: [{ kind: "gap", type: "reflection", matchingCount: 15, totalQualifying: 25 }],
    detectedFindings: [{ kind: "hour", type: "spark", bucket: "midday", matchingCount: 3, totalWithHour: 3 }],
  } });
  h.render();
  assert.equal(text(h.find("conditions-notes-read")), "fifty-three notes · twenty-two days");
  assert.ok(text(h.find("conditions-findings")).includes("the reflections come after quiet"));
  assert.ok(text(h.find("conditions-findings")).includes("fifteen arrived after a day away"));
  assert.equal(text(h.tree).includes("spark"), false);
});

test("empty resistance still shows actual resistance note count and teaching", async () => {
  const { h, patterns, notes, teachings } = lensHarness("resistance");
  assert.deepEqual(Array.from(patterns[0].types), ["resistance"]);
  patterns[0].onData({ resistance: { itemCounts: {}, evidencePageCount: 0 } });
  notes[0].onData({ docs: ["resistance", "spark", "resistance", "resistance", "resistance"]
    .map((type) => ({ data: () => ({ type }) })) });
  teachings[0].resolve(teaching("isolated resistance held line"));
  await tick();
  h.render();
  assert.equal(text(h.find("resistance-note-count")), "resistance · 4 notes");
  assert.ok(h.find("lens-teaching-link"));
  assert.ok(h.find("lens-closing"));
  assert.equal(text(h.find("lens-held-line")), "isolated resistance held line");
});

test("route changes clear open teaching, ignore old reads and unsubscribe prior lens", async () => {
  const t = lensHarness();
  t.teachings[0].resolve(teaching("isolated conditions held line"));
  await tick(); t.h.render();
  t.h.find("lens-teaching-link").props.onPress(); t.h.render();
  assert.equal(t.h.type("SheetShell").props.open, true);
  t.route("resistance");
  assert.equal(t.patterns[0].stopped, true);
  assert.equal(t.h.find("lens-held-line"), undefined);
  assert.equal(t.h.type("SheetShell"), undefined);
  t.teachings[1].resolve(teaching("isolated resistance held line"));
  await tick(); t.h.render();
  assert.equal(text(t.h.find("lens-held-line")), "isolated resistance held line");
  assert.equal(t.h.type("SheetShell").props.open, false);
  t.route("conditions");
  t.route("resistance");
  t.teachings[2].resolve(teaching("late stale conditions held line"));
  t.patterns[2].onData({ conditions: { findings: [{ kind: "gap", type: "dream", matchingCount: 99 }] } });
  await tick(); t.h.render();
  assert.equal(t.h.find("lens-held-line"), undefined);
  assert.equal(text(t.h.tree).includes("ninety-nine"), false);
});

test("auth changes cannot retain another owner's note count, teaching or evidence", async () => {
  const t = lensHarness("resistance");
  t.notes[0].onData({ docs: [{ data: () => ({ type: "resistance" }) }] });
  t.auth({ uid: "second-isolated-owner" });
  t.teachings[0].resolve(teaching("stale first owner teaching"));
  t.notes[0].onData({ docs: [{ data: () => ({ type: "resistance" }) }] });
  await tick(); t.h.render();
  assert.equal(t.notes[0].stopped, true);
  assert.equal(t.h.find("resistance-note-count"), undefined);
  assert.equal(t.h.find("lens-held-line"), undefined);
});

test("permission errors are explicit errors, not a quiet empty pattern fallback", () => {
  const t = lensHarness();
  const error = Error("isolated permission failure");
  t.patterns[0].onError(error);
  assert.throws(() => t.h.render(), (actual) => actual === error);
});

test("ordered resistance-note query errors and teaching read errors are not silent empty states", async () => {
  const resistance = lensHarness("resistance");
  assert.equal(resistance.notes[0].query.orderBy, "createdAt desc");
  const notesError = Error("isolated ordered-query failure");
  resistance.notes[0].onError(notesError);
  assert.throws(() => resistance.h.render(), (actual) => actual === notesError);
  const conditions = lensHarness();
  const teachingError = Error("isolated teaching-read failure");
  conditions.teachings[0].reject(teachingError);
  await tick();
  assert.throws(() => conditions.h.render(), (actual) => actual === teachingError);
});

test("single-lens adapter never subscribes to unrelated roots or evidence", () => {
  for (const [type, expected] of [
    ["conditions", ["users/isolated/patterns/conditions"]],
    ["resistance", ["users/isolated/patterns/resistance", "users/isolated/patterns/resistance/evidence"]],
  ]) {
    const reads = [];
    const state = load("lib/patternEvidenceState.ts", () => { throw Error("unexpected import"); });
    const adapter = load("lib/patternEvidence.ts", (name) => {
      if (name === "@/lib/firebase") return { db: {} };
      if (name === "@/lib/patternEvidenceState") return state;
      if (name === "firebase/firestore") return {
        doc: (_db, ...parts) => parts.join("/"),
        collection: (_db, ...parts) => parts.join("/"),
        onSnapshot: (ref) => { reads.push(ref); return () => {}; },
      };
      throw Error(`unexpected import ${name}`);
    });
    adapter.subscribePatternDocuments("isolated", () => {}, () => {}, [type])();
    assert.deepEqual(reads, expected);
  }
});