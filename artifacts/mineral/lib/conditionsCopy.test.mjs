import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { hourConditionCopy } from "./conditionsCopy.ts";
const require = createRequire(import.meta.url);
const { deriveConditionsPattern } = require("../../../functions/patternEngine.js");
const source = readFileSync(new URL("../../../attached_assets/Conditions_Copy_Matrix_1791061316554.md", import.meta.url), "utf8");
let type;
let checked = 0;
const hours = { morning: 9, midday: 10, evening: 17, night: 21 };
for (const line of source.split("\n")) {
  const heading = line.match(/^\*\*(\w+)\*\*$/);
  if (heading) type = heading[1];
  const cell = line.match(/^- (morning|midday|evening|night)[^:]*: `([^`]+)` · `([^`]+)`/);
  if (!cell) continue;
  const [, bucket, text, evidence] = cell;
  assert.deepEqual(hourConditionCopy(type, bucket, "three", "three"), {
    line: text, evidence: evidence.replace("{m}", "three").replace("{t}", "three"),
  });
  const notes = Array.from({ length: 3 }, () => ({
    type, createdAt: new Date("2026-10-01T12:00:00Z"), localHour: hours[bucket],
  }));
  const pattern = deriveConditionsPattern(notes);
  assert.ok(pattern.findings.some(f => f.kind === "hour" && f.type === type && f.bucket === bucket));
  assert.equal(pattern.unsupportedFindingCount, 0);
  assert.equal(deriveConditionsPattern(notes.slice(0, 2)).findings.filter(f => f.kind === "hour").length, 0);
  checked++;
}
assert.equal(checked, 36);
for (const type of ["other", "future", "constructor", "__proto__"]) {
  assert.equal(hourConditionCopy(type, "midday", "three", "three"), null);
  const pattern = deriveConditionsPattern(Array.from({ length: 3 }, () => ({
    type, createdAt: new Date("2026-10-01"), localHour: 12,
  })));
  assert.equal(pattern.findings.filter(f => f.kind === "hour").length, 0);
  assert.equal(pattern.unsupportedFindingCount, 1);
}
assert.equal(hourConditionCopy("spark", "unknown", "three", "three"), null);
console.log("All 36 approved cells match the source byte-for-byte; engine coverage and unsupported guards pass.");