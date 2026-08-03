# Mineral — Slice T-c: Type Polish (tracking, the Begin pill, serif assignments, Guide density)

*Micro-slice following T-b, from founder device QA. Standing instruction applies. Four fixes; nothing else. The updated Slice T serif table (with its new Tracking column) is canon — this slice applies it.*

## 1. Serif tracking + weight (the missing air)

Apply the Slice T §2 serif table's tracking and line-height values — they were absent from the first pass: `serifDisplay` +0.6 · `serifTitle` +0.5 · `serifLarge` +0.4 · `serifMedium` +0.4 · `serifBody` +0.3 · `serifSmall` +0.3, with the revised line-heights (each +1) and **500 weight at 18px and below** (serifBody joins serifSmall at 500). Token-file change only — every serif in the app inherits. Re-check the epigraph two-line max and CTA title for wrap after tracking lands.

## 2. The CTA has two variants — restore the compact Begin

§6a's "full-width pill" applies ONLY to the announcement CTA (the Origin encounter affordance: state eyebrow + title + arrow). The **Begin pill is the second variant** — v6's BeginButton, restored:

- Container hugs its content: `alignSelf: 'center'`, `borderRadius: 999`, paddingVertical 14, paddingHorizontal 28, same near-white ground `rgba(244,240,250,0.97)`.
- Row layout: a 34pt circle tinted with the phase accent (`#C44A8A` for Signal) containing a small dark play triangle → 12pt gap → a tight column: **Begin** (Cormorant 500i · 19 · `#0a0510`) over **3 min · voice** (Inter 500 · 10 · UPPERCASE · tracking 1.4 · `rgba(10,5,16,0.55)`).
- No trailing arrow on this variant (the play glyph is the signifier).
- Used on: the Threshold screen and the onboarding begin card. The Origin affordance keeps the full-width variant unchanged.

## 3. Serif/sans title assignments — explicit override list (intent beats the mechanical map)

The §4 migration map moved these by their OLD sans sizes; they belong to the serif register. Reassign:

| Element | Now renders | Must render |
|---|---|---|
| Encounter title (Threshold screen — "The Returning Signal") | sans `display` | `serifTitle` |
| Today-tab phase name ("The Signal") if sans | — | `serifTitle`, phase text-tint permitted |
| Any onboarding question headline still sans ("When were you born?" era) | sans | `serifDisplay` |

Everything else the mechanical map produced stands. Screen/utility titles (SETTINGS, FIELD GUIDE, NOTES) remain sans — the serif is the ritual voice, not a heading style.

## 4. The serif budget (Guide density fix)

Rule, app-wide: **serif is for the sacred line, sans is for structure — and a screen carries at most a handful of serif moments, not a wall.** Concretely in the Guide: the ONE featured quote (`YOUR WORDS, RETURNING`) and lens exemplar quotes stay `serifBody`; **FRESH/feed excerpts switch to sans `body`** with their attributions in `metadata` (a list of italic serif paragraphs is what "feels busy" — quotes stop being special when everything is one). Add breathing room between Guide rows: 20pt minimum vertical rhythm between entries. Same principle anywhere else a LIST renders serif items (companions sheet descriptors are short and stay serifSmall; multi-line list content goes sans).

## 5. Acceptance

- [ ] Tracking visibly present on the epigraph/⟡/season lines (compare against a pre-slice screenshot); no new wraps.
- [ ] Threshold screen: compact Begin pill, centered, play circle tinted, no dead white field; Origin affordance unchanged.
- [ ] "The Returning Signal" (and all encounter titles) render in Cormorant.
- [ ] Guide: only the featured quote + lens exemplars in serif; feed in sans; row rhythm ≥ 20pt.
- [ ] No raw sizes introduced — all changes via tokens/components. File list in checkpoint summary.

## 6. Origin wander-state adjustments (hierarchy + spacing)

The wander state currently reads structure-first; the ritual voice must lead.

- **Caption block:** station name renders `serifTitle` (26 · 500i · tracked — the wandered station is the headline of the moment); the meta line beneath (`december 1985 · age 10.5 · …`) renders `metadata` (11) in `textTertiary` with +0.4 tracking. Spacing: ≥ 16pt clear above the caption (from the map clearance zone, per 2.1.1) and **≥ 28pt below it before the CTA** — the caption and the pill must never touch shoulders.
- **Label recession during wander:** one station leads. The approached station's label, structure subscript, and adjacent years stay at full strength; the OTHER three stations and their structure subscripts drop to 50% of their current opacity; all non-adjacent year labels drop one step dimmer than their stations. (Daily state is unaffected — labels stay silent there.)
- **HUD tokens:** the Origin HUD station name uses `serifTitle`, its structure subscript stays the map micro register — no bespoke sizes.

## 7. Added acceptance
- [ ] Wander to any position: the serif station name is visibly the loudest text on screen; non-approached stations recede; caption clears the CTA by ≥ 28pt.

## 8. The serif doctrine — "serif speaks; sans explains" (founder ruling, applies in this slice)

**Serif (Cormorant) is ONLY for:** (a) titles/subheads of ritual objects — encounter titles and subtitles, season titles, station names; (b) questions the practice asks — the ⟡ prompt, season question, counterweight question; (c) one-line held thoughts — epigraph, hold line, close line, carry closings, the woven line; (d) **the user's own words, quoted.** Nothing else.

**Sans (Inter) for everything that explains or operates:** instructions and practice steps (integration bodies like "Sit in silence for sixty seconds…" move from `serifMedium` → **`bodyLarge`** — new token, 16/24/400), descriptive/helper copy (onboarding value lines, permission-screen bodies, the signature helper), ALL buttons and controls (the CTA title and the Begin label switch to Inter 500 — §6a is amended; the serif never renders inside an interactive control), lens promise lines (they explain mechanism → `metadata`), and all meta.

**Migration list (old → new):** block instruction bodies → `bodyLarge` · onboarding helper/value copy → `bodyLarge` or `body` by prominence · CTA/Begin titles → Inter 500 per amended §6a · lens promise lines → `metadata` · companion descriptors STAY `serifSmall` (they are captions of ritual objects, not explanations). Anything ambiguous: ask "is this line *spoken* by the practice, or is it *explaining* something?" — explanation goes sans. List every reassignment in the checkpoint summary for founder veto.

## 9. Added acceptance
- [ ] No serif inside any pressable (grep the CTA/Begin/Links components).
- [ ] Integration/practice instruction bodies render `bodyLarge` sans; the ⟡ question above them remains serif — the contrast between the two registers should be visible on one screen.
- [ ] Reassignment list delivered.

## 10. One signifier per link (founder QA, device screenshot)

`linkSecondary` currently renders BOTH the trailing arrow and the hairline on some strings (Settings: `sign out →`, `release this field →`). Ruling, now in Slice T §6d: **a link carries the arrow OR the hairline, never both.** In the `linkSecondary` component: when the label ends in ` →`, suppress the wrapper hairline (arrow is the signifier); arrowless strings (`not now`, `skip · add later`) keep the hairline. Press states unchanged for both.

## 11. Added acceptance
- [ ] Settings: `sign out →` and `release this field →` render with no underline; `not now`-class links elsewhere keep their hairline. No tappable text shows both signifiers anywhere (grep + visual pass).

## 12. Section heads are not eyebrows (founder QA, Guide screenshot)

The Guide's `EXPLORE` and `FRESH` render in the 10pt eyebrow register — too small to anchor a section of a long scroll. Rule, app-wide: **an eyebrow labels a single element** (a card, a CTA, a quote block — `YOUR WORDS, RETURNING` is correct as an eyebrow); **a head that anchors a SECTION of a scrolling page uses `sectionTitle`** (Inter 18 · 500), rendered lowercase, color `textSecondary`, with rhythm ≥ 32pt above and 12–14pt below. The dimmer color + weight is what separates wayfinding from content — lens names below it stay `textPrimary`.

Apply now: Guide `EXPLORE` → `explore`, `FRESH` → `fresh` (both `sectionTitle` per above). Same species elsewhere — Settings' `YOUR FIELD` / `RELEASE`, and any other in-page section head found in the sweep — migrate identically; list each in the checkpoint summary for founder veto. Screen titles (`SETTINGS`, `FIELD GUIDE`, `NOTES` at the top of a screen) are NOT section heads and are unchanged.

## 13. Added acceptance
- [ ] Guide: `explore` and `fresh` render at 18 lowercase sans, visibly anchoring their sections; no 10pt eyebrow heads a section anywhere; the migrated-heads list delivered.
