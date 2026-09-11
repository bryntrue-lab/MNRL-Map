# Mineral — Slice K: the quiet lenses wake (consciousness · conditions · engine hygiene)

*Standing instruction applies; CS vocabulary rules standing. Visual authority for the two lens screens: the founder's "Mineral Lens Concepts" canvas (consciousness spectrum artboard, conditions weather artboard) — match its anatomy and registers. Scope: the patterns engine (functions), two lens detail screens, the Guide's two quiet rows, one lexicon seed, stopword hygiene. Nothing else.*

## K1. Consciousness — where the words stand

**Lexicon (content, founder-editable):** seed `practitionerContent/consciousness_lexicon` (kind `consciousness_lexicon`): word families for the four structures. Starter seed (founder edits in console; these are working defaults, not canon):

- `magic`: ritual, sign, omen, luck, spell, charm, synchronicity, magic, fate, blessing
- `mythic`: story, image, dream, symbol, threshold, journey, quest, myth, fire, shadow, hero, calling
- `mental`: plan, goal, system, measure, analyze, decide, strategy, problem, solve, optimize, workflow, milestone
- `integral`: whole, both, paradox, presence, together, weave, integrate, attune, resonance

Not client-readable if the rules are a kind allowlist — the engine reads it server-side (verify, same as `passage_prompt`).

**Engine (`updatePatterns` extension):** count lexicon matches per structure across the user's notes (same tokenization as motifs); write `patterns/consciousness`: `{ structureCounts: {magic, mythic, mental, integral}, notesRead, leading }`. A structure's count = number of NOTES containing ≥1 of its words (not raw word occurrences). `leading` = highest count (ties: most recent note wins).

**Lens detail (canvas artboard is the layout):** title row + held line + `{n} notes read` meta; the four structures as hairline spectrum rows, count-ordered, widths proportional, single lens color at stepped alphas (no 4-color scheme); one exemplar (freshest note of the leading structure, standard exemplar anatomy); then the serif mirror line (`serifMedium`, 0.85):

- Differing: `the map holds this year in the {mapStructure}. your words answer from the {leading}.`
- Agreeing: `the map and your words stand together in the {structure}.`
- `{mapStructure}` = the structure of the user's current map position (the spiral's existing quadrant/structure mapping — read it from the map code, do not invent a new mapping).

`the teaching →` sheet unchanged. Zero lexicon matches across the field → the lens stays exactly as today (held line + closing paragraph); never render an empty spectrum.

**Guide row, when live:** subtitle becomes `your words stand in the {leading}` (replaces the held-line subtitle; held line remains inside the detail). Row stays quiet-form until the patterns doc has ≥1 nonzero count.

## K2. Conditions — the weather

**Note context (app, capture path):** new field notes gain `localHour` (0–23) and `weekday` (0–6), written client-side at creation from the device clock. Existing notes lack them — the engine skips hour/weekday findings for notes without the fields (no backfill guessing from UTC).

**Engine (`updatePatterns` extension):** write `patterns/conditions`: findings, each computed only when its evidence reaches **n ≥ 3 within a note type or context bucket**:

- Hour: type × time-of-day bucket (morning <10, midday 10–17, evening 17–21, night ≥21) — e.g. all ≥3 resistance notes with hours fall in night → finding.
- Gap: notes created the day after a zero-note day, when ≥3 exist → "after quiet" finding for the dominant type among them.
- Findings carry: a line key, the counts (`3 of 3`, `9 of 11`), and the bucket — the client renders the words.

**Lens detail (canvas artboard is the layout):** title + held line + `{n} notes · {n} days` meta; findings as sans line + metadata evidence line, ≥28pt apart. Line templates (founder-vetoable, verbatim):

- `resistance arrives at {night}` / `{three} of {three} walls · named after nine`
- `reflection belongs to your {mornings}` / `{nine} of {eleven} · before ten`
- `the {dream} and the {symbol} came after quiet` / `each arrived the morning after a day away`

Zero findings → lens stays as today. **Guide row, when live:** subtitle `{two} weathers noted`.

## K3. Engine hygiene — the lint stops surfacing

Extend the engine stopword list with conversational fillers so they can never appear as GATHERING items or ARRIVING chips: `though, exactly, sure, actually, almost, along, already, another, anyway, really, maybe, quite, rather, perhaps, especially`. (Recent chips `exactly · sure · though` are the motivating examples; `manifest`, `goals`, `toward` are meaningful words and stay.) Rebuild patterns once after deploy so existing lint clears.

## Acceptance

- [ ] Founder's field: consciousness row goes live with a leading structure; detail shows spectrum + exemplar + mirror line; the map structure named matches her actual spiral position.
- [ ] Conditions: after a few new notes carry `localHour`, at least the hour-bucket finding path is demonstrable (test account with seeded times is acceptable); founder's row may legitimately stay quiet until evidence accrues — quiet is correct, not a failure.
- [ ] Empty states: a fresh account shows both lenses exactly as today (no empty spectrum, no zero findings).
- [ ] `exactly` / `sure` / `though` gone from GATHERING and ARRIVING after rebuild; real words unaffected.
- [ ] Lexicon doc server-only (rules check); founder edits a lexicon word in console → next rebuild reflects it, no deploy.
- [ ] File list: functions (engine + lexicon seed), two lens screens, guide rows, capture path (two fields), stopword list. Nothing else.

## Out of scope

Tap-through from GATHERING/ARRIVING (depends on Slice J's note sheet — rides with J); passages for structures/weathers (G2 queue, later); any teaching copy changes.
