"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");
const block = rules.slice(
  rules.indexOf("match /practitionerContent/{contentId}"),
  rules.indexOf("// ── Trigger Email")
);
assert.match(block, /allow read: if request\.auth != null\s*&& \(resource\.data\.kind == 'teaching'\s*\|\| resource\.data\.kind == 'counterweight_pools'\s*\|\| resource\.data\.kind == 'offering'\)/,
  "existing kind whitelist is unchanged");
assert.match(block, /allow get: if request\.auth != null[\s\S]*&& !exists\(\/databases\/\$\(database\)\/documents\/practitionerContent\/\$\(contentId\)\)/,
  "additional permission is authenticated get-only and nonexistent-only");
assert.equal((block.match(/allow read:/g) || []).length, 1);
assert.equal((block.match(/allow list:/g) || []).length, 0);
assert.match(block, /allow write: if false;/);
const idPattern = block.match(/contentId\.matches\('([^']+)'\)/)?.[1];
assert.ok(idPattern);
const expectedId = new RegExp(idPattern);
for (const id of ["word_return", "word_fear", "motif_the-threshold", "resistance_self-doubt"]) {
  assert.equal(expectedId.test(id), true, id);
}
for (const id of [
  "passage_prompt", "word_return home", "word_Return", "word_", "word_a/b",
  "teaching_missing", "motif_", "motif_a--b", "resistance_-fear", "unrelated",
]) assert.equal(expectedId.test(id), false, id);
console.log("Guide missing-offering rules boundary tests passed");