# Mineral — Slice D.3d: The Guide, Final Form (refinement merge)

*Supersedes the D.3 Part B layout and D.3c's view items; D.3c's ENGINE items are restated in §3 (skip any already shipped). Attach `Mineral_Guide_v4_Prototype.html` — the single visual authority (the v2 prototype is retired; where prose and prototype disagree, the prototype wins). Standing instruction applies: guide tab + its components, the engine items in §3, and the two §4 token lines. Nothing else.*

## 0. Amendments now canon (recorded, not open for interpretation)

1. **The synthesis sentence is retired.** The hero states the fact; nothing states it twice. This supersedes D.3 §B2. The **taking-root** post-encounter moment retargets: hero word bloom + the root-line underline on the exemplar, once per completion, never on ordinary opens. The `TAKING ROOT` eyebrow is retired with it.
2. **Section markers in the compressed Guide are `eyebrow` (10 · 600 · UPPERCASE · tracking 1.8 · `textMuted`)** — an explicit, Guide-scoped amendment to the T-c §12 ruling, which stands everywhere else (long scrolls use `sectionTitle`). Never the 9px `micro` register.
3. **Offerings never assert meaning.** Canon voice rule for all "from the field" content, present and future: interpretations are located in traditions/others ("has been read as…", "the old practices treated…"), plural in possibility, never declared by the Guide itself. The two shipped strings are in §1e.

## 1. The view (guide.tsx — build to the prototype)

**a. Header, centered, matching every other tab:** `FIELD GUIDE` (existing centered screen-title register) with the **field line** centered beneath it, `metadata`: `{n} notes · {age}` (`the first week` days 1–7, then `{m} days`).

**b. `RETURNING` — the hero:** eyebrow marker, then the item in `serifDisplay` (30) with the count (`3 notes · one day`, `metadata`) on the same baseline. ONE exemplar — the freshest — as a left-hairline block (`serifBody` 18, item occurrences at full white, attribution `metadata`), carrying the root-line underline. Beneath: `linkWhisper` `all {count-word} notes →` opening the lens detail that owns the item (recurring language for words/phrases; mythic motifs for lexicon items). Hero source precedence unchanged (highest established → gathering → newest arrival; phrases > lexicon items > words on ties, then most recent).

**c. Offering:** if a `practitionerContent` offering matches the hero item, it renders in the quiet container directly below the hero block, `body` at `textTertiary`, `FROM THE FIELD` micro-eyebrow inside. Absent when none matches.

**d. `GATHERING`:** collapsed rows — item (`serifSmall` 16 · 500i) left, count word (`metadata`) right, hairline below. Tap expands that row's two exemplars in place; expanding one collapses any other. Max 3 rows, phrases first. No captions of any kind. Section absent when nothing sits at two.

**e. Canonical offering strings (verbatim):**
- support (motif): `The old practices treated a thing named three times in one day as one that had arrived before the day began.`
- water/sea (motif): `Water has been read as a symbol of the unconscious, of emotion, of transition. Currents that return are often noted as carrying what the waking mind has not yet held.`

**f. `ARRIVING TODAY`:** chips as built, now each carrying its in-day count (`practices 2`) — label `label` register, count `textMuted`. Section absent on days without captures. (Section renamed from "today's arrivals" — the eyebrow reads `ARRIVING TODAY`.)

**g. `THE LENSES`:** live rows only — dot · name (`body` 14 white) · **count phrase only** (`metadata`: `one word · one phrase`, `the same wall, three times`) · `→`. No prose status lines. Quiet lenses collapse to the ONE listening line (`metadata`, `textMuted`) with individually tappable lens names (prior ruling stands; ≥44pt targets; no added signifiers).

**h. Footer signature, one line:** `{type distribution} · the field is {age} old` (`metadata`, `textMuted`, hairline above). Replaces the two-line "the field" section; the section head is gone.

**i. Unchanged and protected:** the empty-state spec (opening description + all five lens rows with held-line status), the teaching sheets and their whispers, lens detail views, `about the guide →`.

## 2. Vertical rhythm

Per the prototype: 34pt title-block → hero; 26pt between sections; 10–11pt row padding inside sections. The whole live view at week-one density fits one screen above the tab bar.

## 3. Engine items (from D.3c — SKIP any already shipped)

1. Stopword list gains modal/auxiliary verbs: `can could would should will shall may might must`.
2. A single-WORD item must be ≥ 4 characters to display in gathering.
3. Display-trim list is connectives-only: `and but or so the a an of that with` — trailing only, never leading, never interior ("this work is important to me" renders in full).
4. Run the rebuild callable after list changes.

## 4. Token lines (two, exactly)

1. Add/confirm the whisper color as a token (`rgba(200,190,225,0.55)`) and use it for the hero's `all … notes →`.
2. Remove `CormorantGaramond_600SemiBold_Italic` from the font-loading list — no token maps to it (verify with grep first; if anything references it, report instead of removing).

## 5. Acceptance (on the founder's live field)

- [ ] One screen: centered title/field line → RETURNING (support · one exemplar · whisper) → offering → GATHERING (collapsed) → ARRIVING TODAY → THE LENSES → footer signature — no scrolling needed at week-one density; no synthesis sentence anywhere.
- [ ] Tap gathering row → both exemplars expand in place; tapping a second row collapses the first.
- [ ] Hero whisper lands on the owning lens detail with all exemplars.
- [ ] Complete an encounter → open Guide → hero bloom + root-line fire once; not on the next open.
- [ ] "this work is important to me · twice" full phrase; no modal/short-word items in gathering.
- [ ] Offerings render the §1e strings verbatim.
- [ ] Grep: no 9px outside `micro`'s sanctioned uses; no reference to the removed 600i variant; every Guide size resolves to a token.
- [ ] File list in checkpoint summary; nothing outside guide tab/components, §3 engine items, §4 tokens.
