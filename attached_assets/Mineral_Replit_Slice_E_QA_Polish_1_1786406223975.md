# Mineral — Slice E: Post-D QA Polish (founder device QA, 2026-08)

*Micro-slice. Standing instruction applies: only the items below; no refactors, no layout changes beyond what each item states. Where copy is quoted it is final. E7 assumes D.3 Part B (the Guide restructure) lands FIRST — do not duplicate its work here.*

## E1. Onboarding

1. **Remove the "unlocks" panel** entirely (the membership/unlocks list screen or card). Nothing replaces it — onboarding flows directly to the next step. The membership invitation lives at day 8, not in onboarding.
2. **Birth question copy (final):** headline stays **"When did you arrive?"** (`serifDisplay`), now with a sans subtitle beneath (`bodyLarge`, `textSecondary`): **"This anchors your timing map into your design."** The subtitle is what makes the poetic question legible — do not add any other helper text.
3. **Birth data fields, future-proofed for Human Design:**
   - Birth date — required, stored ISO (`YYYY-MM-DD`). Use the native date wheel; no free-text parsing.
   - Birth time — optional, native time picker, stored `HH:mm` (24h). Label: `time, if you know it` (`metadata`). One-tap skip.
   - Birth place — **optional**, free-text string, stored as typed. Label: `place` (`metadata`). No validation, no geocoding in v1.
   - Skipping time/place changes nothing downstream today; the stored formats are what Human Design will need later.

## E2. Capture drawer (Field Notes / signal capture)

- Fix the text field's vertical alignment inside the sheet (it currently sits misaligned when the drawer rises with the keyboard — the input must sit directly above the keyboard with its padding intact).
- **Exit paths (both):** swipe-down on the sheet dismisses it (drag handle affordance stays), AND tapping the scrim above the sheet dismisses the keyboard first, then the sheet on second tap. Keyboard also dismisses on downward drag inside the sheet (`keyboardDismissMode="interactive"`).
- Discard behavior unchanged (existing keep/discard logic — this slice touches geometry and dismissal only).

## E3. Top nav icons

The Settings (and any sibling top-nav) icon is under-sized. Standardize: **24pt glyph inside a ≥44×44pt tap target**, aligned to the screen-title baseline grid. Token/constant, not a one-off size.

## E4. Counterweight capture ("keep what's here")

When the input drawer rises, it positions too high — the typing line ends up off-screen. Fix: the input anchors **just above the keyboard** (same corrected geometry as E2; share the component/behavior rather than duplicating). Verify with the keyboard up on the smallest supported iPhone: question visible above, input line visible, cursor never hidden.

## E5. The close screens — collapse to ONE

There are currently two consecutive screens ending the encounter, both with a "Return to Map" CTA, and the second's content sits too high to read. Ruling: **one close screen only.** It is the canonical close: the day's epigraph (serif, vertically centered in the upper third — content must be fully visible above the CTA), then the single CTA `RETURN TO THE MAP →`. Delete the second screen; nothing from it moves — if it carried content not on the close screen, list what was dropped in the checkpoint summary for founder review.

## E6. A way back after skipping the audio

Skipping the audio jumps to the ⟡ prompt with no return path. Add a `linkWhisper` at the top-left of the prompt screen: **`← the voice`** — returns to the audio screen at the position it was left (resume logic already exists; this is navigation only). It renders only when the user arrived by skip; completing the audio naturally never shows it.

## E7. Field Guide de-clutter (with D.3 Part B, not instead of it)

The founder's screenshot shows the pre-restructure Guide; most of the clutter is already resolved by specs in flight — apply them, then the additions below:

- D.3 Part B: hero/gathering/arrivals structure, live-rows-only, the ONE collapsed listening line, FRESH removed, the field signature. **The section currently titled `THE FIELD, IN ORDER` is the feed — it is REMOVED by B7** (Notes owns the feed; renaming it did not satisfy the removal).
- T-c §12 (already patched or pending): section heads are `sectionTitle` lowercase — `EXPLORE`-style eyebrows gone.
- The serif `listening.` status lines under lens rows disappear with B6 (quiet lenses collapse; live rows get specific sans status lines).
- **Additions, this slice:** vertical rhythm in the Guide — ≥ 28pt between major sections, ≥ 20pt between rows within a section; the lens dot stays the only iconography (no new icons — the de-cluttering is space and hierarchy, not ornament). The `TAKING ROOT` eyebrow + synthesis stay at top per D.3 B2.

## E8. `bodyLarge` down one point (founder ruling, from the teaching-sheet QA)

The `bodyLarge` token drops **16 → 15** (line-height 24 → 22). Token-file change only — every `bodyLarge` consumer inherits: the teaching sheets (the surface this ruling came from), practice-instruction bodies, onboarding helper copy, the E1 subtitle. No component-level overrides, no new one-off sizes. Unchanged: `body` stays 14, `label` 12, `metadata` 11, and all serif tokens. Alpha rules untouched (contrast, not size, is the accessibility constraint — 15 at `textSecondary` is comfortably clear).

## Acceptance

- [ ] Onboarding: no unlocks panel; "When did you arrive?" + subtitle render (serif question / sans subtitle on one screen); date required, time and place optional with one-tap skips; stored formats verified in Firestore (`YYYY-MM-DD`, `HH:mm`, string).
- [ ] Capture sheet and counterweight input: typing line visible above the keyboard on the smallest supported iPhone; swipe-down and scrim-tap both exit; keyboard collapsible.
- [ ] Settings icon at 24pt/44pt target.
- [ ] Exactly one close screen, epigraph fully visible, single CTA; dropped-content list delivered.
- [ ] Skip-to-prompt shows `← the voice`; completing audio does not.
- [ ] Guide matches the D.3 prototype's structure with the E7 rhythm values; no feed section under any name.
- [ ] `bodyLarge` renders 15/22 everywhere (grep: the token file is the only change); `body` still 14; no inline size compensations introduced; teaching sheet re-checked on device.
- [ ] File list in checkpoint summary; nothing outside the items above.
