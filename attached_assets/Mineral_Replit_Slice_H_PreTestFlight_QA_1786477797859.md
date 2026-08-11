# Mineral — Slice H: Pre-TestFlight QA (founder device QA, round 3)

*Micro-slice; the last QA pass before the AC/TestFlight build. Standing instruction applies; CS vocabulary rules standing. Attach the updated `Mineral_Counterweight_Question_Pools.md` (one question replaced — reseed signal entry 2).*

## H1. Onboarding — birth place label

The city field's label becomes (final, verbatim): **`Birth city, State or Province`**. One text field as built (users may type "Portland, Oregon"); the country picker is unchanged; stored shape unchanged.

## H2. Encounter flow — back · continue · exit, every step

Resume currently lands the user where they left off with no way back. Ruling: **every step of the encounter flow carries all three motions:**

- **Back** (`←`, top-left, whisper register): goes to the PREVIOUS step. From the first prompt, back reaches the audio screen. From the counterweight resolution, back reaches the last prompt. Sequential, no skipping.
- **Continue**: the step's own primary action, unchanged.
- **Exit** (`✕`, top-right, per F2): to Today, state preserved.
- **The audio screen gains a replay control**: a small `↺` (same quiet register as the transport controls) that restarts the audio from the beginning — so "go back and relisten" is always possible, whether the user arrived by resume, by back-navigation, or mid-listen. Resume-position logic is unchanged for ordinary forward flow; `↺` is the explicit way to start over.
- E6's `← the voice` is absorbed by this: the generalized back on the first prompt IS the way to the voice — keep whichever label renders (`←` alone is fine now that back exists everywhere; remove the special-case whisper if it duplicates).

## H3. Practice wheel — selecting a day at small scale

Founder asks for pinch/zoom; ruling is a **scrub-select** instead (one-handed, keeps the wheel's geometry fixed, and reuses the map's existing touch grammar — drag, detent, release):

- Touch anywhere on or near the ring and drag: the NEAREST day dot highlights (enlarged dot + halo), and a floating label follows above the finger: `encounter twelve · The Quiet Yes` (`metadata` + `serifSmall` title), snapping dot-to-dot with a soft detent feel.
- Release on a past day → opens that encounter in visit mode (existing behavior, now reachable precisely). Release on a future day → the label reads `still to come.` and nothing opens. Release off-ring → cancels quietly.
- Plain taps keep working with generous hit slop (nearest dot within ~22pt).
- **No pinch/zoom** — it fights the wander-drag gesture and makes the wheel's scale feel unfixed. If scrub-select proves insufficient in QA, pinch can be revisited as its own slice.

## H4. Counterweight pool update (content)

Signal pool, entry 2 is replaced (both tenses) per the updated pools doc:
- Past: `What did you envision then given only the faintest glimpse of what's to come?`
- Future: `What will you envision then given only the faintest glimpse of what's to come?`
Reseed the pools content; no mechanism changes. *(Note: the future form as the founder wrote it contained a doubled "you you" — corrected here to "will you envision"; flag if the doubling was intentional.)*

## Acceptance

- [ ] Onboarding shows the new label verbatim.
- [ ] From any step of a resumed encounter: back reaches the audio screen step by step; `↺` restarts audio; ✕ exits; forward flow unchanged.
- [ ] Practice wheel: scrub shows the moving highlight + label; release opens past days in visit mode; future days say `still to come.`; taps still work.
- [ ] Two devices/days confirm signal Q2 renders the new wording in the correct tense.
- [ ] File list in checkpoint summary; nothing outside the items above.
