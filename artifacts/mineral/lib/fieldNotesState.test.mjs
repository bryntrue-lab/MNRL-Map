import assert from "node:assert/strict";
import {
  FIELD_NOTES_ORDER_FIELD,
  shouldShowLetter,
  shouldShowReflection,
} from "./fieldNotesState.ts";

assert.equal(FIELD_NOTES_ORDER_FIELD, "createdAt");

assert.equal(shouldShowReflection(6, true), false);
assert.equal(shouldShowReflection(7, false), false);
assert.equal(shouldShowReflection(7, true), true);
assert.equal(shouldShowReflection(41, true), true);

assert.equal(shouldShowLetter(14, true), false);
assert.equal(shouldShowLetter(15, false), false);
assert.equal(shouldShowLetter(15, true), true);
assert.equal(shouldShowLetter(41, true), true);

console.log("field note query and Guide gate tests passed");