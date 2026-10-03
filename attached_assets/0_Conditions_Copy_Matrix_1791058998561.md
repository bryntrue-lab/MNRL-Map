# Conditions — Complete Approved Copy Matrix (founder-veto draft)

**Scope:** hour findings only — gap findings already ship with approved generic copy ("the {type}s come after quiet"). Type `other` is deliberately excluded and stays unsupported. The two existing cells are preserved **verbatim** (marked ✦) — do not regress them.

**Bucket qualifiers** (fixed, from `timeBucket`): morning = `before ten` · midday = `between ten and five` · evening = `after five` · night = `after nine`.

**Evidence template** unless a cell says otherwise: `{m} of {t} {noun} · {qualifier}` — where `{m}`/`{t}` are `spellNumber(matchingCount)` / `spellNumber(totalWithHour)` and the per-type noun is listed below (— means no noun, counts only, matching the existing reflection cell).

| type | verb family | evidence noun |
|---|---|---|
| dream | the dreams surface… | dreams |
| spark | sparks arrive… | sparks |
| resistance | resistance arrives… | walls |
| symbol | the symbols show themselves… | symbols |
| synchronicity | synchronicity finds you… | — |
| vision | the visions open… | visions |
| desire | desire speaks… | — |
| fear | fear visits… | — |
| reflection | reflection belongs to… | — |

## The lines — all 36 cells

**dream**
- morning: `the dreams surface in the morning` · `{m} of {t} dreams · before ten`
- midday: `the dreams surface at midday` · `{m} of {t} dreams · between ten and five`
- evening: `the dreams surface in the evening` · `{m} of {t} dreams · after five`
- night: `the dreams surface at night` · `{m} of {t} dreams · after nine`

**spark**
- morning: `sparks arrive in the morning` · `{m} of {t} sparks · before ten`
- midday: `sparks arrive at midday` · `{m} of {t} sparks · between ten and five`
- evening: `sparks arrive in the evening` · `{m} of {t} sparks · after five`
- night: `sparks arrive at night` · `{m} of {t} sparks · after nine`

**resistance**
- morning: `resistance arrives in the morning` · `{m} of {t} walls · before ten`
- midday: `resistance arrives at midday` · `{m} of {t} walls · between ten and five`
- evening: `resistance arrives in the evening` · `{m} of {t} walls · after five`
- night ✦ (existing, verbatim): `resistance arrives at night` · `{m} of {t} walls · named after nine`

**symbol**
- morning: `the symbols show themselves in the morning` · `{m} of {t} symbols · before ten`
- midday: `the symbols show themselves at midday` · `{m} of {t} symbols · between ten and five`
- evening: `the symbols show themselves in the evening` · `{m} of {t} symbols · after five`
- night: `the symbols show themselves at night` · `{m} of {t} symbols · after nine`

**synchronicity**
- morning: `synchronicity finds you in the morning` · `{m} of {t} · before ten`
- midday: `synchronicity finds you at midday` · `{m} of {t} · between ten and five`
- evening: `synchronicity finds you in the evening` · `{m} of {t} · after five`
- night: `synchronicity finds you at night` · `{m} of {t} · after nine`

**vision**
- morning: `the visions open in the morning` · `{m} of {t} visions · before ten`
- midday: `the visions open at midday` · `{m} of {t} visions · between ten and five`
- evening: `the visions open in the evening` · `{m} of {t} visions · after five`
- night: `the visions open at night` · `{m} of {t} visions · after nine`

**desire**
- morning: `desire speaks in the morning` · `{m} of {t} · before ten`
- midday: `desire speaks at midday` · `{m} of {t} · between ten and five`
- evening: `desire speaks in the evening` · `{m} of {t} · after five`
- night: `desire speaks at night` · `{m} of {t} · after nine`

**fear**
- morning: `fear visits in the morning` · `{m} of {t} · before ten`
- midday: `fear visits at midday` · `{m} of {t} · between ten and five`
- evening: `fear visits in the evening` · `{m} of {t} · after five`
- night: `fear visits at night` · `{m} of {t} · after nine`

**reflection**
- morning ✦ (existing, verbatim): `reflection belongs to your mornings` · `{m} of {t} · before ten`
- midday: `reflection belongs to the middle of your day` · `{m} of {t} · between ten and five`
- evening: `reflection belongs to your evenings` · `{m} of {t} · after five`
- night: `reflection belongs to your nights` · `{m} of {t} · after nine`

## Implementation notes (for Replit)

1. **Engine** (`functions/patternEngine.js`): widen `isApprovedHourFinding` to every type×bucket pair above — i.e., all types except `other`, all four buckets. `other` stays excluded; detection for it keeps flowing to `unsupportedFindingCount`.
2. **Client** (`app/lens/[lens].tsx`, `conditionCopy`): replace the two-cell special-casing with a lookup table keyed `type → bucket → {line, evidence}` built from this matrix. Keep the `return null` fallback exactly as-is — it remains the guard against any future engine output that has no approved copy.
3. **Both existing cells ship byte-identical** to current production strings (marked ✦). Diff them before merging.
4. The client half rides **build 13**; the engine half is a server deploy, any time.
5. Approved ≠ asserted: a cell only ever speaks when the thresholds fire (≥3 notes of the type with localHour, ≥⅔ in one bucket). Approving the full matrix now ends this exercise permanently.
