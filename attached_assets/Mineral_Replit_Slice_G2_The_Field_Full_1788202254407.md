# Mineral — Slice G2: The Field, full design (passages, locators, the gated queue)

*Standing instruction applies; CS vocabulary rules standing. Scope: the practitionerContent data model, the From-the-Field box's render, one firestore.rules verification, one scheduled function, the seed script's offerings section. No other screens, no engine changes, no notification changes.*

## 0. Context — what's live today vs. what this builds

Live today: `practitionerContent` motif docs (`motif_{key}`) hold a single `{ key, keyType, text }`; the Guide/lens "FROM THE FIELD" boxes render that one text, always, with no provenance line. Seeded from `mineral-content/practitioner-content/offerings.json`.

This slice upgrades to the full field design: **multiple passages per key, each with a locator and an approval status; only approved passages ever render; a daily gated queue drafts passages for keys the field has established but the founder hasn't written — drafts stay invisible until the founder approves them by hand.** The founder remains the only voice that reaches users; the queue only ever fills her inbox.

## G1. Data model

Each `practitionerContent` doc of keyType `motif | resistance | condition` gains:

```
passages: [
  { text: string, locator: string | null, status: "approved" | "draft", createdAt, source: "founder" | "generated" }
]
```

- Migration: on seed, each existing single `text` becomes `passages[0]` with `status: "approved"`, `source: "founder"`, `locator: null`. The legacy `text` field is kept and mirrored to the first approved passage (older app builds keep working); new code reads `passages`.
- `offerings.json` shape becomes `{ key, keyType, passages: [{ text, locator }] }` — everything seeded is implicitly `approved` + `founder`. The seed script maps this and stays idempotent.

## G2. Display (existing vessel only — no new UI surfaces)

- The From-the-Field box renders ONE passage per view: from the key's **approved** passages, selected by deterministic daily rotation (`dayOfYear % approvedCount`) — steady, not random; returning users meet the field's other voices over time.
- If the passage has a `locator`, it renders beneath the text as a `metadata`-register line, lowercase, e.g. `from the raga tradition`. No locator → no line.
- Zero approved passages → no box (never render a draft, never render placeholder).
- Box anatomy, position, and register otherwise unchanged.

## G3. The gated queue (scheduled function)

Daily scheduled function `draftFieldPassages`:

1. **Eligible keys:** keys of keyType motif/resistance that are *established in the field* (appear with count ≥ 3 in at least one user's patterns docs) and have **zero passages** (no approved, no pending draft). Single words only, ≥ 4 characters — never phrases.
2. **PRIVACY INVARIANT (non-negotiable, unchanged from the original ruling):** the generation prompt contains the key string and keyType ONLY. Never any user's note text, never counts, never uids, never exemplars. The key is a single common word; nothing else leaves the field.
3. ≤ 3 drafts per day, total. Uses the existing OpenAI secret; the style/system prompt lives in `practitionerContent/passage_prompt` (kind `passage_prompt`, founder-editable in console; seed the default in §G5).
4. Each result writes one `passages[]` entry: `status: "draft"`, `source: "generated"`, with a proposed `locator`. Drafts are invisible to every client by G2's rule.
5. Founder review = flipping `status` to `"approved"` (or deleting the entry) in the Firestore console. No other approval UI in this slice.

## G4. Rules verification

Confirm the client read rule on `practitionerContent` permits the motif/resistance/condition offering docs (they render today, so reads work — verify the rule is by-kind allowlist and that `passage_prompt` is NOT client-readable; if the rule is a kind allowlist, exclude `passage_prompt` explicitly). Report the rule as found; change it only if `passage_prompt` would otherwise be exposed.

## G5. Seeds

1. Convert the ten existing offerings to `passages` form (locators null unless the founder's edited passage doc provides them).
2. The founder's nine authored passages (support ×3, water ×3, door ×3) from her edited copy of the passages doc — attached alongside this slice — seed as `approved`/`founder` with their locators. Support #2 is replaced per her selection (see attachment).
3. Default `passage_prompt` (seed verbatim; founder tunes in console):

> You write single short passages for Mineral's Field Guide — "from the field": one resonant fragment of practice-lore about a given word, in the voice of an old, learned, unhurried tradition-keeper. You are given ONLY a word (a motif such as "water", "threshold", "support") and its type. Write 2–3 sentences that hold the word the way the old practices held it — concrete image first, meaning underneath, no advice, no second person unless it earns itself, no exclamation marks, no em-dash overuse. Draw on real traditions (builders, farmers, monastics, navigators, musicians) without inventing false citations. Then propose a locator: a lowercase provenance phrase of 3–6 words, like "from the raga tradition" or "as the cathedral builders knew". Return JSON: {"text": "...", "locator": "..."}.

## Acceptance

- [ ] Existing boxes unchanged in position/register; passages with locators show the metadata line beneath.
- [ ] A key with two approved passages rotates daily (verify by flipping device date or checking the selection function directly).
- [ ] A `draft` passage renders NOWHERE (add one by hand in console to a visible motif; confirm invisible on device).
- [ ] Queue run (trigger manually once): ≤3 new drafts, only for established keys with zero passages; function logs show prompts contain the key and keyType only — demonstrate with one logged prompt.
- [ ] `passage_prompt` doc is not readable from a client (rules test).
- [ ] Nine founder passages + ten migrated offerings live, approved, rendering.
- [ ] File list: rules (if touched), functions (one new scheduled function), the offering render component(s), seed script offerings section, offerings.json. Nothing else.

## Out of scope

Any approval UI beyond the Firestore console; passages keyed to consciousness structures or conditions weathers (future, after those engines exist); Slice L interactions; notification changes.
