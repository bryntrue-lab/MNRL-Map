# Mineral — Slice CS: Copy Sweep (release vocabulary + off-canon strings)

*Micro-slice, strings only. No layout, logic, styling, or classification changes — every item is an exact old → new text replacement. Run after Slice T-b. Standing instruction applies. Where a string below disagrees with any older document, THIS DOCUMENT WINS.*

## 0. Ruling: "release" is canon

Account deletion speaks the release vocabulary — field-native, unforced. Task C §3's "leave, and take everything with you" wording is retired. The deletion *mechanics* stay exactly as built; only words change here.

## 1. The release family (Settings + confirm)

| Where | String (final) |
|---|---|
| Settings row | `release this field →` *(as built — now canon)* |
| Confirm headline | `release this field.` |
| Confirm body | `Releasing your field deletes everything — every note, every recording, the account itself — permanently. There is no way back.` *(the words "deletes" and "permanently" stay for App Store clarity — do not soften)* |
| Confirm action (2s hold) | `yes — release everything` *(as built — now canon)* |
| Confirm dismissal | `keep it` *(as built — now canon)* |
| Failure line | `something held on. try again.` *(replaces "the release didn't complete. try again.")* |

## 2. Off-canon strings (exact replacements)

| Screen | Old | New |
|---|---|---|
| +not-found | `Go to home screen!` | `return to the map →` |
| +not-found headline (whatever it currently is) | — | `this place isn't on the map.` (serifMedium) |
| ErrorFallback | `Try Again` | `try again` *(string lowercase; the primary-link component renders its own case)* |
| Root index error | `no connection — tap to try again` | `no connection. tap to try again.` |
| Origin wander caption + HUD meta | `turn one · year ten` (life-scale surfaces) | `cycle one · year ten` — the word "turn" → "cycle" on ALL life-scale surfaces (HUD, wander caption, companion descriptors: "one cycle behind/ahead"). The practice wheel's `⤢ the practice` view and its "turn" language are UNCHANGED. *(This is Task C §5's cycle/turn patch — assigned to Slice 5, never landed; it lands here.)* |
| Origin completed-today toast | `complete for today — revisit it via ⤢ this turn` | `complete for today — revisit it from ⤢ the practice` *(the toggle was renamed; this toast never caught up)* |

## 3. Blessed as canon (no change — recorded so they stop being accidental)

- `the threshold isn't ready — the map is. go there →` (audio-not-ready fallback)
- `keep this. →` as the account-moment/AccountForm submit (supersedes Task C's `keep it →`; it echoes the headline deliberately)
- `NEED A WAY IN? ↓` uppercase (per the T-b Step-1 ruling — the one sanctioned tappable eyebrow)

## 3b. Days vs encounters (founder ruling — the two clocks in language)

**"day" names the world's calendar; "encounter" names the practice's sequence.** The practice advances by completion, not by date — positional strings must never count days.

| Kind | Rule | Examples |
|---|---|---|
| POSITION in the sequence | says **encounter** (or the phase-relative form) | practice wheel caption `day six` → `encounter six` · any membership copy `day 8` → `the eighth encounter` · Guide/today references to sequence position |
| DURATION or DATE in the world | **day/days stays** | `8 days ago` · `the field is twenty-three days old` · `COMPLETE · TOMORROW` · notification times |

Sweep addition: grep user-facing strings for `day` + a number/number-word; classify each against the table; apply position changes; list every occurrence (file:line, kind, action) in the checkpoint summary. The free-membership threshold is defined by ENCOUNTER count (entry to the eighth encounter), not calendar day — if any gate logic checks dates rather than `sequenceDay`, flag it in the summary (do not change logic in this slice).

## 4. Sweep instruction

After applying the tables: grep all user-facing strings for Title Case sentences, exclamation marks, and the words "screen", "home", "error", "oops", "loading" — list any found (with file:line) in the checkpoint summary for founder review; change nothing beyond the tables above.

## 5. Acceptance

- [ ] Every table entry applied verbatim; grep confirms the old strings are gone.
- [ ] Release flow read end-to-end on device: row → confirm → hold → failure line (force one) → success path.
- [ ] The §4 sweep list delivered; no other strings changed.
