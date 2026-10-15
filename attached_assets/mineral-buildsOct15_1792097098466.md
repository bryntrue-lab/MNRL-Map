# Mineral — Build ↔ Commit Ledger

*EAS assigns build numbers (`appVersionSource: "remote"`, `autoIncrement: true`), so build numbers are facts recorded AFTER a cut, never names used in plans. **Plans speak in versions:** v1.0.0 = submitted release; v1.1.0 = subscription release. Updated 2026-10-12 from the EAS submission record and founder reports.*

| Build | Commit | Version | Date | Fingerprint | Status |
|---|---|---|---|---|---|
| **15** | `e9ea057` | **1.0.0** | cut Oct 4, submitted Oct 6 | `e65d7a9` | **In App Review** (≈1 week — normal for a first app in 2026; status inquiry sent/plannable at day 7+) |
| 13–14 | *(consumed by intermediate/branch cuts — map via `eas build:list` if ever needed)* | — | ~Oct | — | not store-relevant |
| 12 | `15cfc2d` (probable) | — | ~Sep 30 | — | TestFlight, superseded |
| 10–11 | *(unmapped)* | — | ~Sep | — | superseded |
| 9 | `be1086e` | — | Aug 19 | `ab99f2b3` | superseded |
| 8 | `b4ee976` | — | Aug 15 | `ab99f2b3` | superseded |
| 5–7 | `bccc601`/`b4ee976` | — | Aug 15 | various | superseded |

**Git tag:** `v1.0.0` → `e9ea057` (tag with versions, never EAS numbers). Hotfix base: `git checkout -b hotfix/v1.0.0 v1.0.0`.

## v1.0.0 (build 15, in review) — contents

Beyond build 12: F5a + F5b day-gate fixes · N3 date-caption link · App Attest entitlement · R1b charge capture (close-screen CTA → CaptureSheet "charge" mode → Guide, incl. prompt line) · conditions copy matrix (36 cells, `lib/conditionsCopy.ts`) · Guide/lens offering display (`guideOfferings.ts`, `patternEvidence*`). **Release plan: quiet release on approval — no announcement.** Store page live, App Check re-soak, founding circle moves to store builds. Public launch rides v1.1.0.

## Branch discipline (post-divergence rules, 2026-10-09)

- **No standing dev branch.** `dev` retired once confirmed empty vs main (`git log main..dev`). Identity selection is by build profile (`app.development.json` / `app.production.json` + guard), not by branch.
- Feature branches off `main`: `feat/subscription` (long-lived; merges `origin/main` into itself after every other merge), `feat/ui-*` (short-lived, merge first and often, then delete).
- Production submissions from `main` only. Branch-cut TestFlight builds allowed for internal sandbox testing only — log them here as branch-cut.
- Replit agent: every task prompt names the branch; check `git branch --show-current` before commits. (Agent's "build14" filename labels are stale naming — actual numbers are EAS's.)
- No scope creep into a rejection resubmission if review bounces — hotfix only.

## v1.1.0 (the subscription release — see `mineral-subscription-plan.md`)

RevenueCat + paywall at the gate-8 screen + offer codes. Native change (new fingerprint). Submits from `main` after `feat/subscription` merges. Review should be faster (account now has history; updates clear in ~days).

## Server half — pushed to GitHub, deploy status to confirm

- ▢ `firebase deploy` for functions (`patternEngine.js` word_* offering lookup; `resistanceVocabulary.js`; `fieldQueue.js`; `founderDigest.js`) + `firestore.rules`.
- ▢ Seeding scripts: resistance lexicon (`motifLexicon`, `keyType:"resistance"`), motif top-level text coverage, approved field passages.
- ▢ `backfillPatterns` founder account → verify all five lenses populate.
- ▢ Teaching doc IDs: `teaching_threads` / `teaching_conditions` / `teaching_consciousness` (lens ids, not labels).
- Known display behavior: hero teaching falls back to the generic lens teaching when the hero key lacks an approved passage (days-of-sameness symptom); fix = approve the hero word's passage. Hold-vs-visit rotation = open v1.1 design decision.

## App Check — status

Entitlement rides v1.0.0. Console registration + DeviceCheck `.p8` + dev debug token per earlier plan; re-soak on the quiet release's traffic; enforce when ≥99% verified; verify `betaRequest` after. Not launch-blocking. Watch OpenAI usage until enforced.

## During review — housekeeping

- Refresh demo-account notes every few days (arrivals are day-scoped; reviewer should meet a living Guide).
- No schema-shaped server changes under the submitted binary; content additions fine.
- Check Resolution Center + account email (incl. spam) for silent metadata questions.
