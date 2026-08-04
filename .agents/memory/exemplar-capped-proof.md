---
name: Exemplar-capped proof for phrase merges
description: Why sibling-phrase merges must be gated on full exemplar coverage of the note set
---

Rule: `mergeOverlappingSiblings` in the pattern engine may only merge two
phrases when the stored exemplars cover EVERY contributing note for both
keys (`exemplarsCoverNoteSet`).

**Why:** exemplars are capped at 3 per item. "The union run appears in
every contributing note" can only be verified against stored exemplars, so
with >3 contributing notes the check runs on partial evidence and the
merged count (taken from full itemCounts) can overstate — breaking the
count-and-quote-verbatim law. Caught in the D.3 Part B architect review.

**How to apply:** any future engine rule that generalizes from exemplars to
the whole note set needs the same coverage gate; never trust capped
evidence to prove a universal claim.
