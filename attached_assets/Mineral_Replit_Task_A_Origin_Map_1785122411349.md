# Mineral — Replit Build Task A: The Origin Tab (Timing Map) + Schema v1.7

*Self-contained build task for the Replit agent. Everything needed is in this document — do not invent fields, vocabulary, colors, or behaviors beyond what is specified here. Where this document conflicts with older documents in the repo, THIS DOCUMENT WINS.*

**Project:** `mineral-resonance` Firebase project · Expo / React Native / Firebase JS SDK v12 · expo-router · iOS, Android, web.
**Reference artifacts attached alongside this task:** `Mineral_Origin_Prototype.html` (the behavioral reference — when in doubt about a feel/timing/interaction, open it in a browser and match it), `Mineral_Style_Guide.md` (component and voice rules), `Mineral_Firestore_Schema_Prompt_v1_6.md` (deployed schema baseline).

---

## 0. Decisions already made (do not reopen)

1. **Every one of the 27 days in a phase carries an encounter.** There are no "still-point days" in the v1 practice sequence. The still point is the map's center, not a calendar gap. If any older document says days 7/14/21 offer no encounter, ignore it.
2. **The spiral turns inward.** Turn one is the outermost arc; each later turn nests closer to the still point. Life converges on the center. The first-run animation draws the lived line from the outside in.
3. **Two clocks coexist and must never be wired together.** The map reads the user's *life position* (computed from birth date — `resolve()`, below). The daily encounter comes from the user's *practice position* (`sequenceDay` on the user doc). A brand-new 38-year-old user sees a life map deep in turn two while their encounter is Signal Day 1. Never derive the encounter from `resolve()`. Never derive the map reading from `sequenceDay`.
4. **Timing, not progress.** No spiral surface ever shows completion percentage, streaks, or progress bars. This is load-bearing. If you find yourself adding a counter, stop.
5. **No gating in this build.** Membership checks are deferred; the map and all encounters behave as free.
6. **Vocabulary is fixed** (see §2). Do not introduce "Life Map", "journey", "archive", "library", or coaching language anywhere in UI copy. All UI copy in this document is final unless marked DRAFT.

---

## 1. What this task builds

The Origin tab becomes Mineral's primary daily surface: the user's whole life as an inward-turning spiral, today marked by a pendulum needle, a daily epigraph in the sky above the map, and a quiet doorway into today's encounter. One tap opens the map's reading (season + counterweight + companions). A drag wanders the pendulum across the life. A zoom affordance crosses to the practice scale: the 108-day turn as a wheel of day-dots.

Also in scope: the additive schema v1.7 fields, anonymous auth on first launch, the birth-date onboarding step, and the sequence-selection logic (`sequenceDay`). The encounter flow itself (audio, capture, counterweight resolution) is **Milestone B** — in this task, the encounter CTA navigates to the existing Threshold screen wired to live Firestore content, with Begin showing the graceful not-ready state.

---

## 2. Canonical vocabulary and tokens

**The four stations** (map labels — name over structure subscript):

| Cardinal | Station | Structure | Map color |
|---|---|---|---|
| North | RE-MEMBERING | integral | `#e0568f` |
| East | UNITIVE | magic | `#46d3a0` |
| South | POLARITY | mythic | `#e0a53a` |
| West | DUALITY | mental | `#7f9fe0` |

**The four practice phases** (encounter-facing text only): signal · field · friction · voice. Encounter screens say "Signal"; the map says "Re-membering / integral". Never surface stations and phases together in one line.

**Map atmosphere tokens** (the Origin tab keeps its own palette — do NOT unify with the app's per-phase atmosphere gradients, which are a separate system):
`--bg: #0a0812` · glows `#241a38` / `#141024` · needle/NOW whites at high opacity · `--dim` ≈ rgba(200,190,225,0.5) · `--faint` ≈ rgba(200,190,225,0.22).

**Type registers on this tab:** station names and all ritual lines in the app's serif italic; eyebrows/meta in the sans, UPPERCASE, wide tracking (0.22em+); numbers written as words in the HUD ("turn two · year twenty-three" — use `Math.floor(yearOfTurn)` for the year number).

**Component rules (from the style guide — non-negotiable):** no inline gradient backgrounds — the tab's atmosphere lives in the shared `components/Atmosphere.tsx` system (add an Origin variant there if needed); the map itself is a new shared component in `components/SpiralComponents.tsx` (e.g. `<OriginMap />`), replacing/superseding `LifeMapSpiral`. If `LifeMapSpiral` contains a 27-year cycle constant from an earlier error, it is wrong: the revolution is **28 years**. Exactly one file in the codebase may define a RadialGradient.

---

## 3. Schema v1.7 (additive — no rules, index, or storage changes)

Add to `types/firestore.ts` and use throughout. All six additions are backward-compatible with deployed v1.6.

```ts
// on Encounter (global content)
mapEpigraph: string | null;   // one-line phrase shown on the map the day this encounter is today; falls back to subtitle

// EncounterStatus widens
type EncounterStatus = 'saved' | 'in-progress' | 'completed' | 'visited';

// on users/{uid}/userEncounters/{encounterId_t${turn}}
visitedAt: Timestamp | null;      // first out-of-sequence visit; distinct from startedAt
audioPosition: number;            // seconds into audio, for resume (Milestone B writes this)
blockIndex: number;               // block-screen index, for resume (Milestone B writes this)

// on users/{uid}
sequenceDay: number;              // 1-indexed pointer into the 108-day practice; starts at 1
```

Firestore rules stay as deployed: `sequenceDay` is client-writable (it is not one of the five guarded fields). **Anonymous-auth user-doc creation must satisfy the v1.6 create guard exactly**: on create, write `membershipStatus: 'free'`, `completedEncounterCount: 0`, and `membershipSince`, `membershipExpiresAt`, `membershipProductId` each `null` — plus `sequenceDay: 1`, `currentPhase: 'signal'`, `currentTurn: 1`, `journeyStartedAt`, `createdAt` (serverTimestamp). Writing `charge` anywhere is forbidden (Milestone B concern, noted for consistency).

---

## 4. Auth and onboarding (scope: minimal)

On first launch: `signInAnonymously()` (Firebase Auth persistence per the v1.6 §9 fix — AsyncStorage on native). Create the user doc per §3. The email/password upgrade via `linkWithCredential()` is designed for after the first crystallizing capture — **Milestone B**; do not build the link screen now.

Onboarding step for this task: one screen — eyebrow `M I N E R A L`, serif italic question *"when did you arrive?"*, a date input, `enter →`. Writes `birthDate` to the user doc, then lands on the Origin tab and plays the first-run choreography (§8). If the user skips (allow a quiet *"later"*), the Origin tab renders the no-birth-date state (§7).

---

## 5. The mathematical spine (client-side, pure functions)

```ts
const YEARS_PER_TURN = 28;
const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
const QUARTERS = ['east', 'south', 'west', 'north'] as const;  // named by the station being approached
const PHASE_BY_QUARTER = { east: 'field', south: 'friction', west: 'voice', north: 'signal' } as const;

function resolve(age: number) {
  const turn = Math.floor(age / YEARS_PER_TURN) + 1;
  const yearOfTurn = age % YEARS_PER_TURN;
  const quarterIndex = Math.min(3, Math.floor(yearOfTurn / 7));
  const quarter = QUARTERS[quarterIndex];
  return { age, turn, yearOfTurn, quarter,
    phase: PHASE_BY_QUARTER[quarter],
    bearingDeg: (yearOfTurn / YEARS_PER_TURN) * 360 };
}
```

**Counterweight:** same wheel position, 14 years earlier. Compute the date calendar-anchored (same day-of-year, 14 years back), NOT by millisecond arithmetic — the ritual full date ("Saturday, July 21, 2012") must be exact.

**The counterweight question is keyed to the counterweight position's OWN phase** (which is the opposite of the current phase). Worked example to prevent a known error: a user at year 23 of a turn is in the north quarter → phase `signal`; their counterweight at year 9 is in the south quarter → phase `friction`; the card therefore shows the FRICTION question. An older spec example shows the field question here — it is wrong.

```ts
const COUNTERWEIGHT_QUESTION = {
  signal:   'What was arriving then that this season is answering?',
  field:    'What was gathering then that you are now speaking?',
  friction: 'What were you up against then that has since become material?',
  voice:    'What were you saying then that this season is gathering toward?',
};
```

**The four companions** (for any displayed age): The Echo (age − 28, if ≥ 0) · The Horizon (age + 28, if ≤ 84) · The Ballast (age − 14, if ≥ 0) · The Answer (age + 14, if ≤ 84). Descriptors, verbatim: *"the same season, one turn behind"* · *"the same season, one turn ahead"* · *"what was gathering then, lived"* · *"the counterweight still to come"*. Missing companions are omitted, never greyed.

**Season table** (code constant, keyed `SEASONS[turn][quarter]`, DRAFT strings — the founder may replace strings without structural change; turn ≥ 4 falls back to the generic mode line only):

```ts
const SEASON_MODE = { signal: 'a season of arrival', field: 'a season of gathering',
  friction: 'a season of reckoning', voice: 'a season of articulation' };

const SEASONS = {
  1: { east:  { title: 'The First Weather',      question: 'What weather were you made in?' },
       south: { title: 'The Edges of the World', question: 'What did you learn where the world pushed back?' },
       west:  { title: 'The Borrowed Tongue',    question: 'Whose words did you speak before your own arrived?' },
       north: { title: 'The Door Appears',       question: 'What called before you knew its name?' } },
  2: { east:  { title: 'The Chosen Ground',      question: 'What grows in the ground you chose?' },
       south: { title: 'What the Fire Keeps',    question: 'What survives the burning?' },
       west:  { title: 'The Many Rooms',         question: 'What stays true when someone else is in the room?' },
       north: { title: 'The Seed Remembers',     question: 'What asks to be gathered home?' } },
  3: { east:  { title: 'Becoming the Weather',   question: 'What flourishes simply because you are near?' },
       south: { title: 'What the Fire Finishes', question: 'What is the long fire finishing in you?' },
       west:  { title: 'The Telling',            question: 'What is ready to be handed on?' },
       north: { title: 'The Open Door',          question: 'What was the calling, all along?' } },
};
```

**Practice-day mapping** (the other clock):

```ts
function encounterFor(sequenceDay: number) {
  const phase = ['signal', 'field', 'friction', 'voice'][Math.floor((sequenceDay - 1) / 27)];
  const order = ((sequenceDay - 1) % 27) + 1;
  return { phase, order };
}
// Today's encounter: query encounters where phase == X && order == Y (index #1 exists),
// filter minTurn <= currentTurn client-side. This SUPERSEDES the v1.6 §7 completed-set scan.
// Keep users.currentPhase in sync when sequenceDay crosses a phase boundary (other tabs read it for atmosphere).
```

---

## 6. The Origin tab — primary state

Layout, top to bottom: HUD · the map (fills the middle) · one-time hint · the encounter CTA · tab bar. Match the prototype.

**HUD (top-left):** station name in serif italic (from `resolve(currentAge)`), structure in small caps below. **Top-right:** `turn two` / `year twenty-three` in muted sans (numbers as words), and beneath it the zoom affordance `⤢ this turn` (§9).

**The map:** an inward continuous spiral (one line, not concentric circles) spanning three turns (84 years). The **lived line** (birth → today) renders brighter and terminates exactly at the NOW dot — the segment between the last crossing and today is lived and must render as lived. The future line continues faint. Crossing dots at every 7th birthday: filled in the crossed station's color when lived, faint hollow when to come — this dot grammar is canonical. The pendulum needle runs from the still point to NOW; a **dotted shadow-line** continues from the center to the Ballast position (the counterweight, 14 years back) — this silently teaches the counterweight geometry. The NOW dot carries a halo in the color of the station currently approached, with a slow (~5s) pulse. The still point glows at center — the still point, not NOW, carries the visual weight. The atmosphere breathes (~7s cycle, subtle).

**Station labels are silent in the daily state.** They exist at three moments only: (a) during the first-run drawing, once (§8); (b) whenever the user wanders (§10) — they rise, the approached one brightens, the rest dim; (c) they fade out again on return to today. Label type sizes from the prototype: station name ~10.5 equivalent, structure ~8, crossing years ~9.5 (scale proportionally to the app's type system).

**Daily epigraph:** one serif-italic line, **positioned in the negative space ABOVE the map, right-aligned, max two lines** — never below the map, never overlapping labels. Content: today's encounter's `mapEpigraph`, falling back to `subtitle`. No prefix, no attribution.

**One-time hint:** below the map, tiny caps, `--faint`: `touch the map to read the season`. Disappears forever after the first successful opening of the reading sheet (persist a local flag).

**The encounter CTA — this is a doorway, not chrome.** It is the ONE inviting element on the tab: full-width pill, generous tap target, eyebrow + serif italic title + arrow. States:
- Default: eyebrow `TODAY`, title = today's encounter title → opens the Threshold screen (pilgrim mode).
- In progress (from Milestone B): eyebrow `CONTINUE`, same title.
- Completed today: eyebrow `COMPLETE · TOMORROW`, title = tomorrow's encounter title, arrow dimmed; tap → no navigation (a quiet acknowledgment only).

---

## 7. States without full data

- **No birth date:** the map renders a placeholder still point only; epigraph area shows *"add your birth date to see your spiral →"* (taps into the onboarding step). The CTA still works — the practice clock does not require the birth date.
- **Birth date present, nothing completed yet:** normal map; epigraph is Day 1's (*"The door is already open."*).
- **No encounter doc found for the current sequence position:** CTA hidden; epigraph falls back to *"you are here."*

---

## 8. First-run choreography (once, after birth date is provided)

Match the prototype's timeline (~11–13s; **any tap skips to the settled state**):

1. Fade in from black (~1.8s); the still point appears and glows.
2. The **lived line draws itself from the outside in** — birth at the outer edge, arriving at today (~5.5s, eased). As the line first passes each cardinal, that station's label fades in (learned once). As it passes each 7th-birthday crossing, the dot pops and its **year label** appears — the user watches their own chronology assemble (1982… 1989… 1996…).
3. The future line and future crossings fade in faintly (they are not drawn — they haven't been lived).
4. The needle draws from center to NOW (~1.1s); the halo pulses once; the dotted counterweight shadow-line fades in.
5. HUD, epigraph, CTA, tab bar fade in, in that order.
6. Station labels and year labels withdraw. The hint appears. The map is silent.

No repeat on subsequent opens — the map simply *is*, breathing.

---

## 9. The turn view (⤢ — the practice scale)

The `⤢ this turn` affordance cross-fades the life spiral to the **108-day turn**: a wheel of 108 day-dots around the same still point (NOT the 7-year life quarter — an older spec section says otherwise and is superseded). Phase names sit mid-quadrant in the app's phase accent colors (`#C44A8A / #5DCAA5 / #D89A3A / #6B8EB8`), labeling the 27 days each governs; day 1 begins at north and the wheel runs clockwise. Above the wheel: current phase name in serif italic + `day five` in muted words.

Day-dot grammar: days `< sequenceDay` filled in phase accent · `== sequenceDay` white with soft halo · `> sequenceDay` barely-visible hollow. Days with a `visited` userEncounter get a thin accent ring (data readable now; the visit *write* lands in Milestone B).

Taps: today's dot → same as the CTA. A past day → navigate to the Threshold screen for that day's encounter with eyebrow `VISITING · DAY N` (visit framing; Begin behavior per §11). A future day → a quiet toast: *"still to come."* Future days do not open — wandering honors the past; the sequence protects the future. The affordance flips to `⤢ the life` to return.

---

## 10. Reading and wandering (life view)

**Gesture map (canonical):**

| Gesture | Result |
|---|---|
| Tap anywhere on the map (not a crossing) | Open the reading sheet |
| Tap the NOW dot / needle | Open the reading sheet |
| Drag the pendulum | Wander: labels rise, caption live-updates below the map |
| Release drag near a cardinal (±~0.5y) | Detent-snap, soft haptic tick |
| Tap a crossing dot | Swing the pendulum to that date |
| Tap the counterweight card (in sheet) | Dismiss sheet, swing to the counterweight |
| Tap a companion row | Swing there, close sheet |
| Tap `TODAY →` chip (appears while wandering, replacing turn/year meta) | Swing home; labels and caption fade; epigraph returns |
| Swipe up from the lower map region | Open the reading sheet |

**Wander state:** station labels visible (approached one bright, others dim), lived crossing years visible, and beneath the map a centered caption: station name in serif italic over a meta line `April 2012 · age 36.9 · turn two · year nine`. The epigraph hides while wandering.

**The reading sheet** (bottom sheet, ~45–50% height — the still point and needle must remain visible above it; dim only the arcs): grabber · eyebrow `THE MAP OFFERS, THIS SEASON` · season title (serif italic, from `SEASONS`) · mode line in small caps (`A SEASON OF ARRIVAL`) · divider · season question (serif italic, large) · **counterweight card**: eyebrow `YOUR COUNTERWEIGHT TODAY`, the **full ritual date** (*Saturday, July 21, 2012* — weekday, month, day, year, calendar-exact), question per §5 keying, tappable → swings the pendulum · footer link *"four companions on the chord →"* in dim lavender (never the station accent).

**Companions sheet** (second sheet): four rows — small-caps name, italic descriptor beneath, right-aligned `1998 · age 23`. Rows swing the pendulum and close. Sheet content always reflects the *displayed* position (wandered or today).

Use Reanimated 3 (or the project's existing animation lib) for pendulum/sheet motion; a bottom-sheet library is acceptable.

---

## 11. Threshold screen wiring (the seam with Milestone B)

The existing scaffolded Threshold screen must now render live Firestore data: `encounters/{slug}` resolved via `encounterFor(sequenceDay)` (or the tapped day, in visit framing), showing eyebrow (`TODAY'S ENCOUNTER` / `VISITING · DAY N`), `title`, `subtitle`, and the Begin pill (play glyph, `Begin`, `3 min · voice`). Remove ALL hardcoded placeholder content. In this milestone Begin resolves the Storage URL for `audioPath`; if unavailable or the flow isn't built yet, show the graceful line *"This encounter isn't ready yet."* and a quiet return to the map — no error dialog, no retry button. Milestone B replaces this stub with the full flow.

---

## 12. Acceptance checklist

- [ ] Fresh install → anonymous auth → user doc passes the v1.6 create guard (verify in Rules Playground) → birth-date step → first-run choreography plays once, skippable by tap.
- [ ] Map renders correctly for arbitrary birth dates (test: 1975-05-20 → turn two, year twenty-three, approaching Re-membering; a 2003 birth date → turn one; a 1950 birth date → turn three).
- [ ] Lived line terminates at NOW; dotted shadow-line points at the Ballast; dot grammar correct; no station labels in the settled daily state.
- [ ] Epigraph = Day 1's `mapEpigraph` after seed re-run ("The door is already open."), upper-right, never touching labels at any viewport size.
- [ ] Tap anywhere opens the reading; counterweight date is calendar-exact and its question uses the counterweight's own phase (worked example in §5 must hold).
- [ ] Drag wanders with labels risen and caption live; TODAY chip returns and silences everything; detent-snap works.
- [ ] ⤢ crosses to the 108-day wheel; day states correct for `sequenceDay`; future days refuse politely; past days open the Threshold screen in visit framing.
- [ ] CTA navigates to the Threshold screen showing live seeded content (The Threshold, "saying yes to not knowing"); Begin shows the not-ready state without erroring.
- [ ] `grep -rn "RadialGradient"` returns exactly one defining file. No progress bars, streaks, or percentages anywhere on the tab.
- [ ] TypeScript types updated for all six v1.7 fields; app compiles clean on iOS, Android, web.
