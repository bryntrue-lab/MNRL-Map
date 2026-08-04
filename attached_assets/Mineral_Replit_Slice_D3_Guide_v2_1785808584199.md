# Mineral — Slice D.3: The Guide Speaks First (view restructure + backfill)

*Follows D.1/D.2. Standing instruction applies. Attach `Mineral_Guide_v2_Prototype.html` alongside this doc — it is the visual authority; where prose and prototype disagree, the prototype wins. Two parts: Part A is functions-only, Part B is the guide tab only. Checkpoint after EACH part. No engine-pipeline changes, no LLM, no new lens math — the tiers, counts, and copy rules from Task D are unchanged and remain canon.*

---

## Part A — the backfill (functions only; run and checkpoint first)

**The bug this fixes:** the engine fires on fieldNote create, so notes created before D.1 deployed were never processed. The founder's live field proves it: six notes containing "support" three times, and the Guide's synthesis fell through to "Six notes across two days." instead of rule 1.

- Add an idempotent backfill that runs the existing D.1 pipeline over every fieldNote not yet in the processed ledgers. Implementation: a callable (`backfillPatterns`, self-only via `request.auth.uid`, same as deleteAccount's guard) that queries the caller's fieldNotes, skips ids already in each pattern doc's ledger, and processes the rest through the SAME pipeline function — no duplicated logic.
- Also invoke the same check cheaply on the trigger path: if a note arrives and the ledger is missing earlier notes, process them too (self-healing; keeps future deploys from re-creating this gap).
- No schema changes. No new counting logic. Deletes still reverse everything.

**Gate A:** founder taps nothing — on next app open (call the callable once on Guide mount if any note predates the newest pattern doc's `updatedAt`), the existing six-note field produces: thread doc counts support=3, the phrase "this work is important to me"=2; synthesis becomes *"Support appears in 3 of your 6 notes."* Checkpoint here.

## Part B — the view (app/(tabs)/guide.tsx and its components only)

Restructure the Guide tab to the prototype's architecture, top to bottom. All type via tokens; section heads per T-c §12 (`sectionTitle`, lowercase, `textSecondary`); serif doctrine applies throughout.

### B1. Header
`FIELD GUIDE` (unchanged) with the **field line** under it, `metadata`: `{n} notes · {age}` — age phrases: `the first week` (days 1–7), then `{m} days`. Replaces the current tagline sentence.

### B2. Synthesis (kept, re-typeset)
D.2's precedence rules unchanged. New rendering: the ITEM NAME inside the sentence renders `serifBody` (the user's word, quoted — serif); the rest of the sentence is sans `bodyLarge` `textSecondary`. The taking-root moment (post-encounter animation) stays exactly as built.

### B3. `returning` — the hero (new; replaces YOUR WORDS, RETURNING's position at top)
The strongest current pattern, staged:

- **Source precedence:** highest-count established item (≥3; threads and motifs pooled, phrases before words on ties) → else highest gathering item (=2) → else the most recent arrival word. With ≥1 note there is ALWAYS a hero — this is the every-time guarantee at view level.
- **Rendering:** the item large in `serifDisplay`-scale (prototype: 38px serif italic — use `serifDisplay`), count line `metadata` beneath (`3 notes · one day`); then up to three verbatim exemplars as left-hairline blocks, `serifBody`, with the item's occurrences at full white against context at `textSecondary` weight; attributions `metadata` (`type · source · relative time`). The FRESHEST exemplar carries the taking-root underline (existing animation, retargeted here).
- **Offering:** if a `practitionerContent` offering matches the hero item, it renders beneath in the existing offering container. Nothing renders if none matches.
- This section replaces `YOUR WORDS, RETURNING` as the featured module. The eyebrow `YOUR WORDS, RETURNING` is retired from the top of the Guide (the hero's exemplars ARE the words returning). **Featured-quote bug fixed by construction:** the hero selects by count, never by recency alone — "Test four" can no longer headline.

### B4. `gathering` (kept from D.2, repositioned)
Items at count 2, phrases first: item in `serifBody` + `· twice` in `metadata`, expandable to both verbatim exemplars side by side (prototype shows the expanded state). Caption under an expanded phrase pair, `metadata`: `the same sentence, twice — shown side by side` (phrases only; words get no caption). Section absent when nothing sits at two.

### B5. `today's arrivals` (kept from D.2, unchanged behavior)
Chips as built; section absent on days without captures.

### B6. `the lenses` — live rows only + the collapsed line
- A lens row renders ONLY when it has content. Its status line is SPECIFIC, from its data, sans `body`/`metadata` with item names in `serifSmall`: e.g. `one wall named — overwhelm` · `two phrases · five words returning` · `the sea · door · weight`. The generic promise lines no longer render on live rows.
- ALL quiet lenses collapse into ONE line, `metadata` at `textMuted`: `{names, · separated} — listening.` (e.g. `mythic motifs · conditions · consciousness — listening.`). The five-row listening wall is retired. The collapsed line is not tappable in this slice.
- Lens detail views (opened by `→`) are unchanged in this slice.

### B7. `FRESH` is removed
Notes owns the feed (founder QA of record). Delete the section.

### B8. `the field` — the signature (new, closes the view)
Two lines: chip-type distribution in words, `body` `textTertiary` (`five reflections · one resistance` — types with zero notes omitted, order by count); then `the field is {age} old.` in `metadata` `textMuted`. Computed from fieldNotes directly (so deletes reflect immediately).

### B9. Teaching scaffold (plumbing only — content comes later)
Add rendering support for `practitionerContent` docs with `kind: 'teaching'`, keyed by lens: held line (`serifMedium`) + paragraphs (`bodyLarge` `textSecondary`), rendered inside the lens DETAIL view — replacing the empty state on quiet lenses, below the data on live ones. **If no teaching doc exists (none will yet), everything renders exactly as today** — quiet lens details keep their promise lines. No teaching copy ships in this slice; the founder seeds it later as content.

## Copy rules (unchanged, restated)
Tier language fixed (*entered your field / has appeared twice / appears in N of your notes*). Forbidden words stand: theme, insight, meaning, journey, progress, streak, and any sentence with the user as subject of an interpretive verb. Numbers under ten spelled out in sentences; numerals in counts. Every quote verbatim, attributed `type · source · relative time`.

## Acceptance

- [ ] **Gate A first**, exactly as written, on the founder's live field.
- [ ] Guide top-to-bottom matches the prototype's week-one state against the founder's real field: field line · synthesis naming *support* · `returning` hero = support with three exemplars · `gathering` = "this work is important to me" twice · arrivals chips · two live lens rows + one collapsed listening line · no FRESH · the field signature.
- [ ] Delete a note containing "support" → hero count drops to 2 and the section re-stages as gathering-sourced; signature updates. Re-create it → restores.
- [ ] Section heads render per T-c §12; no serif inside any pressable; no forbidden words (grep).
- [ ] Taking-root animation fires once after an encounter completion, on the hero's freshest exemplar.
- [ ] File list in checkpoint summary; nothing outside functions (Part A) and the guide tab + its components (Part B).
