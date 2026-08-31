# Mineral — Slice G2 (FINAL): The Field, Opened — passages, the sheet, the gated queue

*Supersedes both "Slice G: The Field" and the earlier "Slice G2: full design" doc — this is the single canon. Design intent, governing every judgment call: the field is where a member goes to feel more visionary and more confident in their own voice. The passages lend the weight of traditions; the `IN YOUR FIELD` section beneath them hands the authority back — the user's own sentence holding its place under centuries.*

*Standing instruction applies; CS vocabulary rules standing; the D.3d §0 revoice canon governs every passage, seeded or generated: readings are located in traditions, plural in possibility, never asserted by the Guide.*

## 0. Current state this slice builds on

Live today: `practitionerContent` docs (`motif_{key}`) hold a single `{ key, keyType, text }`; the From-the-Field boxes render that one text, always, no locator, no sheet. Seeded from `offerings.json`. This slice is additive on top of that.

## G1. The field sheet (view)

- When a motif's doc has ≥ 1 **approved** passage, its offering card gains a whisper inside the card's bottom edge — `more from the field →` — and the card becomes tappable, opening a sheet (the teaching-sheet component):
  - Motif name (`serifTitle`)
  - The passages in order: body `bodyLarge` sans `textSecondary`; locator line beneath each in `metadata` `textMuted`; ≥ 20pt between passages
  - Eyebrow `IN YOUR FIELD`, then the user's exemplars carrying this motif, verbatim (`serifBody`, attributed `type · source · relative time`)
- The offering card itself renders as today (its box text = the first approved passage; see G2 migration).
- **No empty rooms:** zero approved passages → the card renders exactly as today and is not tappable. No placeholder, no "coming soon."
- Also reachable from the mythic-motifs lens detail: a motif row whose doc has passages gains the same whisper beneath its exemplars.

## G2. Schema + migration + seed content

- Docs gain `passages: [{ text, locator, status: 'approved' | 'draft', source: 'founder' | 'generated', createdAt }]` (additive). **Only `status: 'approved'` renders — ever.**
- **Migration (seed script):** each existing offering's single `text` becomes `passages[0]` (`approved`, `founder`, `locator: null`); the legacy `text` field is kept mirrored to the first approved passage so older builds keep working. `offerings.json` becomes `{ key, keyType, passages: [{ text, locator }] }` (seeded entries implicitly approved/founder); the seed stays idempotent.
- **Seed the following nine, verbatim** (founder-final content; revisions are content edits, not code):

### support

1. `The old builders understood that nothing rises without bearing. An arch stands because every stone in it leans — each one held exactly where it presses hardest. What carries weight has been read, again and again, as a thing that is itself carried.` — locator: `as the cathedral builders knew`
2. `In the old ragas, the soloist never sang into silence. Behind every improvisation a drone held one unbroken tone — and the melody's whole freedom rested on something that never stopped sounding beneath it.` — locator: `from the raga tradition`
3. `The foresters have found that the woods feeds its own: the tall trees pass sugar down through the dark to the seedlings in their shade. Asking for nourishment has been read there not as weakness but as how a forest flourishes.` — locator: `as the foresters read it`

### water

1. `The alchemists called it solutio — the stage in which what has hardened is permitted to dissolve. It was never read as ruin. It was read as the necessary softening before a truer form.` — locator: `as the alchemists read it`
2. `In the dream traditions, water has been read as what moves beneath the daylight mind — feeling, memory, the unlived. Deep or shallow, still or breaking: each state of it was read as news from below.` — locator: `in the dream traditions`
3. `The oldest Chinese texts honored water as the softest thing that overcomes the hardest. It takes the low place, asks no permission, and arrives everywhere. Patience of that kind has been read as a form of power.` — locator: `in the Taoist reading`

### door

1. `The Romans set a two-faced god at the doorway — one face on what ends, one on what begins. A threshold was never neutral ground; standing in one was understood as standing in both lives at once.` — locator: `in the Roman houses`
2. `The monastic rule ordered that every knock be answered as if the stranger were the awaited one. A door, in that reading, is not a barrier that sometimes opens — it is a question that keeps being asked from the other side.` — locator: `in the monastic rule`
3. `In folktale after folktale there is a door that keeps appearing until it is opened. The traditions did not read the recurring door as a warning. They read it as an invitation that has not yet been taken at its word.` — locator: `in the dream traditions`

## G3. The generation queue (functions — gated, never live)

- New scheduled function, daily: for each motif/word that reaches **established** (≥3) for any user and has NO passages in ANY status, generate **3 draft passages** via the existing OpenAI secret. Single-word keys only, ≥4 characters — never phrases.
- **PRIVACY INVARIANT: prompt inputs are the motif key ONLY — never any user's note text, counts, exemplars, or uids.** Demonstrate with one logged prompt in the checkpoint.
- The system prompt lives in `practitionerContent/passage_prompt` (kind `passage_prompt`, founder-editable in console, seeded by this slice). Its seeded contents embed: the design-intent line at the top of this doc, the revoice canon (located · plural · never asserted), the forbidden-word list, and the nine G2 passages as exemplars of register and length. Output JSON per passage: `{ text, locator }`, written as `status: 'draft'`, `source: 'generated'`.
- **Draft passages never render** (G1 filters on `approved`). Founder review = editing the doc and flipping `status` in the Firestore console; no admin UI in this slice.
- Cap: ≤ 3 motifs drafted per day. Dedupe: never generate for a motif with passages in any status.
- **G3b — founder notice:** when the run creates ≥1 draft, write one doc to the `mail` collection (Slice M's Trigger Email contract): subject `the field drafted {n} passages`, body listing the keys. No drafts → no email. (If Slice M hasn't landed, log-only until it does — do not build separate email plumbing.)

## G4. Rules

- Verify the client read rule on `practitionerContent` covers the offering docs (they render today) and explicitly does NOT expose `passage_prompt` to clients. Report as found; change only if `passage_prompt` would be readable.

## Acceptance

- [ ] Support/water/door offering cards carry the whisper and open the sheet; passages render with locators; `IN YOUR FIELD` shows the founder's real exemplars beneath.
- [ ] A motif with no approved passages: card unchanged, not tappable (verify on any lexicon motif without content).
- [ ] Grep: rendering path filters `status === 'approved'`; no draft can reach a screen. Add one draft by hand in console to a visible motif; confirm invisible on device.
- [ ] Migration: all ten pre-existing offerings render exactly as before (box text unchanged), now backed by `passages[0]`.
- [ ] Trigger the generator against a test motif (dev): drafts land `status: 'draft'`, invisible in-app; flipping one to `approved` in the console makes it render without a deploy; G3b mail doc written (or logged if M absent).
- [ ] Generation prompt contains no user text (code review of prompt assembly + one logged prompt).
- [ ] `passage_prompt` not client-readable (rules test).
- [ ] File list: G1 view components, seed script offerings section + offerings.json, functions (one scheduled), rules if touched. Nothing else.

## Out of scope

Approval UI beyond the console; passages keyed to consciousness structures or condition weathers (after those engines exist); Slice L; notification changes.
