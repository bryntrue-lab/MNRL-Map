# Mineral — Slice G2b: generation-queue guardrails (purge · cap · vocabulary)

*Standing instruction applies. Functions + one seeded doc + one purge. No app code, no view changes.*

## 0. What happened

First live run of `draftFieldPassages` produced **81 drafts in one night** — the spec's cap is ≤3 per day — and the drafted keys include conversational lint (`actually`, `almost`, `along`, `already`, `another`, `appear`…), because eligibility ("any established word ≥4 chars") is far too permissive against real note language. No user saw anything (the approved-only render gate held, as designed), but the founder's review inbox is unusable and every excess draft is wasted spend.

## G2b-1. Purge

One-time: delete every `passages[]` entry with `source: "generated"` (all are `status: "draft"`; verify none were approved first — if any generated entry is already approved, list it and leave it). Report the count removed. Founder-authored passages untouched.

## G2b-2. Enforce the cap — for real

- Hard cap: **≤ 3 generation calls per run**, counted at the OpenAI call site, not at the eligibility list. If eligibility yields more candidates, take the top 3 by (distinct users established for, then total count) and stop.
- One run per day (verify the schedule didn't double-fire; if the 81 came from one run, the loop simply never checked the cap — fix and add a test).

## G2b-3. Vocabulary: the field's words are chosen, not scraped

Eligibility becomes an allowlist intersection, not an open trawl:

- Eligible keys = (keys in `motifLexicon` ∪ keys in `practitionerContent/queue_allowlist`) that are established (≥3) for at least one user AND have no passages in any status.
- Seed `practitionerContent/queue_allowlist` (kind `queue_allowlist`): `{ words: [] }` — empty. The founder adds words in the console when her Guide (or a tester's pattern) surfaces one that deserves field-lore (e.g. `flow`). The digest's drafted-keys line is how she notices candidates.
- The stopword question disappears entirely under this rule — no heuristics, no word-length tests. The field speaks only vocabulary the founder or the lexicon has named.

## G2b-4. Digest line accuracy

The "awaiting you" section counts **pending drafts total** and, separately, **drafted last night** (≤3). Subject-line count = pending total. (Slice M's function may need the second number passed or derived — keep it to a count query.)

## Acceptance

- [ ] Purge report: N generated drafts removed, 0 approved entries touched; founder passages intact (spot-check support/water/door).
- [ ] Manual run with an artificially long eligibility list: exactly 3 OpenAI calls, 3 drafts, run report says so.
- [ ] A word not in lexicon ∪ allowlist never drafts, however established; add `flow` to the allowlist doc → next run may draft it (demonstrate).
- [ ] Digest shows `0 awaiting you` the morning after the purge (or only legitimately drafted keys).
- [ ] File list: functions, the allowlist seed, purge script. No app code, no rules changes.
