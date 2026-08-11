# Mineral — Slice F: Encounter Flow + Onboarding QA (founder device QA, round 2)

*Micro-slice. Standing instruction applies: only the items below. CS vocabulary rules are standing rules for all new strings.*

## F1. Onboarding

1. **Time field label (final, verbatim):** `Birth time, if you know it`
2. **Birth place, structured:** replace the free-text field with two inputs — **`birth city`** (text) and **`country`** (picker from a static ISO country list — no network, no geocoding API). Store `{ city: string, country: string, countryCode: string }`. Placeholder for city: `city or town`. Both remain optional with the one-tap skip. *(Rationale: deterministic enough to geocode server-side when Human Design ships; no API dependency today. Do NOT add a places/autocomplete service.)*

## F2. Exit from everywhere in the encounter flow

Every screen in the encounter flow — play/voice, warm-up, ⟡ prompt, hold, counterweight resolution, close — gets a quiet exit: **✕ top-right, 24pt glyph in a ≥44pt target, `textTertiary`**, no confirm dialog. Exit returns to the Today tab; state is preserved exactly as the existing resume logic has it (audio position, typed draft kept as the current draft behavior dictates — exiting changes nothing about persistence, it only navigates). The `← the voice` whisper (E6) is unaffected — it navigates within the flow; ✕ leaves it.

## F3. Prompt screens are content-driven — no blank screens

"The Soul Has a Posture" surfaced a blank screen mid-series: the flow is rendering a fixed number of prompt screens instead of the encounter's actual blocks. Fix: **the screen sequence is generated from the encounter's block array — a screen exists only if its block has content.** Encounters legitimately vary in block count; a short series is correct, an empty screen never is. Add a guard: any block whose text resolves empty is skipped (and logged to the checkpoint summary with encounter id + block index so bad content is caught, not silently swallowed).

## F4. Prompt screen navigation

Remove the **right arrow**. Remaining affordances: the left arrow (back within the series), the `← the voice` whisper where applicable, the ✕ (F2), and the forward motion belongs to the screen's own primary action. One way forward, deliberately.

## F5. The daily gate — one encounter per day, restored

The gate has drifted: encounters can currently be played ahead. Restore: **one encounter completion per local calendar day.**

- Completing today's encounter advances `sequenceDay` and the CTA flips to `COMPLETE · TOMORROW`; the NEXT encounter unlocks at the next local midnight.
- Until unlocked, the next encounter is not reachable from any surface (CTA is the quiet acknowledged state; the practice wheel shows future days closed — `still to come.` — as spec'd).
- Wandering/visiting PAST encounters (visit mode) is unchanged — the gate is on the sequence's forward edge only.
- **F5a — the flip bug:** founder completed an encounter and the CTA did NOT flip to `COMPLETE · TOMORROW`. Fix with the gate work (likely the same state seam: completion status not propagating to the Origin/Today CTAs). Acceptance is the full loop on device.

## F6. Counterweight question repetition — mechanism + rotation

Founder observation: the same counterweight question two days running ("What were you up against then that has since become material?").

**Why (not a bug, but a real design gap):** the counterweight is the life-map position 14 years across — it moves one day per day, so its *phase* changes only every ~7 years, and the question is keyed to that phase. By construction it repeats for long stretches; fine on the map (a season IS slow), stale as a daily line in the encounter flow.

**Fix — rotate the angle, keep the season:** each phase gets a small pool of counterweight questions (target 4 per phase; the existing phase question is entry one). Daily selection: `pool[sequenceDay % pool.length]` — deterministic, no repeats on consecutive days, no randomness. Content ships as practitioner content (founder-editable); UNTIL the founder supplies the pools, seed each phase's pool with its existing single question — the mechanism lands now, the variety lands with content. Tense handling (past/future counterweight variants) applies per question exactly as it does today.

## Acceptance (on device)

- [ ] Onboarding: new time label verbatim; city + country picker; both skippable; stored shape verified in Firestore.
- [ ] From every encounter screen, ✕ exits to Today; reentering resumes where the flow was.
- [ ] "The Soul Has a Posture" plays end-to-end with no blank screen; short series render short; skipped-block log delivered (empty if content is clean).
- [ ] Prompt screen: no right arrow.
- [ ] Complete today's encounter → CTA reads `COMPLETE · TOMORROW`; the next encounter is unreachable until local midnight; after midnight it opens (founder verifies next morning); past-day visits still work.
- [ ] Two consecutive days show different counterweight questions once pools have ≥2 entries; with a single-entry pool, behavior is unchanged.
- [ ] File list in checkpoint summary; nothing outside the items above.
