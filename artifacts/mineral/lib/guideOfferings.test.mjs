import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import {
  currentGuideOfferingContent,
  guideOfferingReceiver,
  guideOfferingTarget,
  guideOfferingText,
} from "./guideOfferings.ts";

const approved = { status: "approved", text: "Approved field passage." };
const draft = { status: "draft", text: "Unapproved draft." };

test("word document uses exact engine stem; unknown phrases have no fallback", () => {
  assert.deepEqual(guideOfferingTarget({ type: "thread", key: "return" }),
    { docId: "word_return", keyType: "word" });
  assert.deepEqual(guideOfferingTarget({ type: "thread", key: "returning" }),
    { docId: "word_returning", keyType: "word" }, "do not stem again");
  for (const key of ["unknown phrase", "return home", "Return", ""]) {
    assert.equal(guideOfferingTarget({ type: "thread", key }), null);
  }
  assert.deepEqual(guideOfferingTarget({ type: "motif", key: "The Threshold" }),
    { docId: "motif_the-threshold", keyType: "motif" });
  assert.deepEqual(guideOfferingTarget({ type: "resistance", key: "Self / Doubt" }),
    { docId: "resistance_self-doubt", keyType: "resistance" });
});

test("word drafts, unreviewed text and empty approvals do not render", () => {
  for (const content of [
    null,
    { text: draft.text },
    { text: draft.text, passages: [draft] },
    { text: approved.text, status: "draft", passages: [approved] },
    { passages: [{ status: "approved", text: "  " }, draft] },
    { passages: [{ status: "approved", text: true }] },
  ]) assert.equal(guideOfferingText(content, "word"), null);
});

test("approved word selection mirrors server stored order and compatibility choice", () => {
  const second = { status: "approved", text: "  Another approved passage.  " };
  assert.equal(guideOfferingText({ passages: [draft, approved, second] }, "word"), approved.text);
  assert.equal(guideOfferingText({ text: second.text, passages: [approved, second] }, "word"),
    second.text, "preserve verbatim selected approved copy");
  assert.equal(guideOfferingText({ text: draft.text, passages: [draft, approved] }, "word"),
    approved.text);
  for (const keyType of ["motif", "resistance"]) {
    assert.equal(guideOfferingText({ text: "Compatibility text.", passages: [draft] }, keyType),
      "Compatibility text.");
    assert.equal(guideOfferingText({ passages: [approved] }, keyType), null,
      "passage approval does not replace top-level compatibility selection");
  }
});

test("hydration is subscription-tagged; missing results and revoked approvals clear copy", () => {
  const a = guideOfferingTarget({ type: "thread", key: "return" });
  const b = guideOfferingTarget({ type: "resistance", key: "fear" });
  let hydration = null;
  const receiver = guideOfferingReceiver(a, (next) => { hydration = next; });
  receiver.receive({ passages: [approved] });
  assert.equal(guideOfferingText(currentGuideOfferingContent(a, hydration), "word"), approved.text);
  assert.equal(currentGuideOfferingContent(b, hydration), null, "no old hero flash before effect");
  const aAgain = guideOfferingTarget({ type: "thread", key: "return" });
  assert.equal(currentGuideOfferingContent(aAgain, hydration), null, "A → B → A is a new read");
  receiver.close();
  const nextReceiver = guideOfferingReceiver(aAgain, (next) => { hydration = next; });
  nextReceiver.receive(null);
  receiver.receive({ passages: [approved] });
  assert.equal(currentGuideOfferingContent(aAgain, hydration), null, "late old callback ignored");
  nextReceiver.receive({ passages: [approved] });
  nextReceiver.receive({ passages: [draft] });
  assert.equal(guideOfferingText(currentGuideOfferingContent(aAgain, hydration), "word"), null);
  nextReceiver.receive(null);
  assert.equal(currentGuideOfferingContent(aAgain, hydration), null);
  nextReceiver.close();
  nextReceiver.receive(null);
  assert.equal(currentGuideOfferingContent(aAgain, hydration), null,
    "late error callbacks are ignored just like late snapshots");
});

test("actual Guide hero ranking remains independent of approval coverage", () => {
  const source = readFileSync(new URL("../app/(tabs)/guide.tsx", import.meta.url), "utf8");
  const ts = createRequire(import.meta.url)("typescript");
  const code = ts.transpileModule(source.slice(
    source.indexOf("function poolItems("), source.indexOf("/** Age phrase")
  ), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = {};
  vm.runInNewContext(code, context);
  const patterns = {
    thread: {
      itemCounts: { "unknown phrase": 3, return: 3 },
      exemplars: {
        "unknown phrase": [{ capturedAt: { toMillis: () => 20 } }],
        return: [{ capturedAt: { toMillis: () => 10 } }],
      },
      offerings: { return: { text: approved.text } },
    },
  };
  const hero = context.poolItems(patterns).sort(context.heroFreshnessOrder)[0];
  assert.equal(hero.key, "unknown phrase");
  assert.equal(guideOfferingTarget(hero), null, "keep uncovered freshest hero, not covered runner-up");
  const duplicate = context.poolItems({
    ...patterns, motif: { itemCounts: { return: 3 }, exemplars: {} },
  }).find((item) => item.key === "return");
  assert.equal(duplicate.type, "motif", "lexicon pooling preference unchanged");
  assert.match(source, /firstApprovedFieldPassage\(heroPassageContent\)/,
    "motif passage sheet still uses existing approval boundary");
  assert.match(source, /\(error\) => \{\s*receiver\.receive\(null\);\s*console\.warn\("guide offering", error\)/,
    "listener errors clear stale teaching and remain explicit, not treated as silent absence");
});