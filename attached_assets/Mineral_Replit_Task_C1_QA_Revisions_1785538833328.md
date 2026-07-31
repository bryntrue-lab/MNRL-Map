# Mineral — Replit Task C.1: QA Revision Pass (founder device testing, July 31)

*Self-contained revision task from on-device QA. Priority order: §1 bugs first, then §2 readability, then the rest. Where this conflicts with anything older, THIS DOCUMENT WINS. All copy strings quoted here are final unless marked DRAFT.*

---

## 0. Decisions made in this pass (do not reopen)

1. The birth-date headline is **"when did you arrive?"** with helper line *"This anchors your timing map into your design."* ("When were you born?" is retired — arrival is Signal language; born is form language.)
2. The scale toggle is renamed: **`⤢ the practice`** (from the life view) / **`⤢ the life`** (from the practice view). "This turn" is retired from the toggle — the practice wheel is the map of the work; the life spiral is the map of the years. Internal vocabulary (cycle/turn) is unchanged; this is UI labeling only.
3. The companions eyebrow becomes **`THE CONTINUUM OF THIS MOMENT`**; the link line becomes *"four companions of this moment →"*. "Chord" is retired from UI copy (kept as an internal geometry term only).
4. Every capture point in the app offers **both voice and text**, and the mode toggle works in **both directions** at any point before keeping.
5. The counterweight becomes quietly **capturable** (see §6) — the map may ask; the user may answer; nothing is required.

---

## 1. Bugs (P0 — fix before anything else)

**1a. Crossing-tap swings to the wrong position.** Tapping any dated dot on the map (station crossings AND counterweight-side dots) must swing the pendulum TO that dot's own date — `selAge = that dot's age` — and the reading sheet must then describe that position. Currently tapping a counterweight-side dot (e.g. 2031) leaves the pendulum elsewhere (e.g. 2045). Rule: the reading sheet always describes the pendulum's position; a tap on any dated thing takes the pendulum there.

**1b. Future counterweights speak in past tense.** When a position's counterweight date is AFTER today's real date, use the future-tense question set (§9) and the eyebrow `THE COUNTERWEIGHT, TO COME`. Past counterweights keep the existing questions and `THE COUNTERWEIGHT` (or `YOUR COUNTERWEIGHT TODAY` when the pendulum is at now). Tense is determined by the counterweight date vs. the device's today — never by the pendulum position alone.

**1c. TODAY pill wraps mid-drag.** The 'y' drops to a second line while dragging. Fix: fixed min-width, `numberOfLines={1}`, no reflow during drag.

**1d. Top icons unresponsive** (Threshold/Today view — hamburger etc.). Every header icon gets a real handler or is removed. No dead chrome. (If the hamburger has no menu to open in v1 — remove it entirely; the style guide's screens show it as mockup furniture, not a required control.)

**1e. Notes capture sheet:** text field vertically misaligned; no way to dismiss the keyboard or exit the sheet. Fix alignment; add swipe-down-to-dismiss + tap-outside-to-dismiss + a quiet `✕`; keyboard dismisses on drag.

**1f. RECENT shows "your field is empty" after captures exist.** The feed query is broken or unrefreshed. Fix the query (chronological fieldNotes, `createdAt DESC`) and refresh on sheet close / tab focus.

**1g. Voice↔type toggle is one-way on the ⟡ screen.** After choosing *type instead*, a *speak instead* toggle must return to hold-to-record (and vice versa), preserving any typed draft until the capture is kept.

**1h. No sign-in path for existing accounts.** Users who linked an email have no way to sign in on reinstall/new device. Add: on the hello screen, a small quiet line — *"already keeping a field? sign in"* — opening email/password sign-in (`signInWithEmailAndPassword`); same entry in Settings. On success, land on the Origin tab with the user's data. Wrong password: *"that doesn't match. try again."* No password reset flow in this pass unless trivial (`sendPasswordResetEmail` + one line: *"send a reset link"*).

## 2. Readability (the map must be legible to normal humans)

- **Station labels:** ~14pt equivalent (name), ~11pt (structure subscript). **Spiral year labels:** ~12pt minimum. **HUD:** station name ~24pt serif, meta ~12pt. All type on the map ≥ 11pt rendered — nothing smaller, anywhere.
- **Header/tab icons:** iOS standard is a **44×44pt minimum tap target** with glyphs ~22–28pt. Audit every header icon and the TODAY pill against 44pt targets.
- Respect Dynamic Type where feasible on non-map text (encounter screens, sheets).

## 3. Map interactions

- **Pinch-to-zoom + pan on the life spiral** (bounded: ~1×–2.5×, rubber-banded, double-tap to reset). This is magnification only — not the fractal zoom; the practice wheel remains the ⤢ toggle.
- Toggle relabel per §0.2; position unchanged.
- Wandered positions in the future keep the existing eyebrow language (*"at this bearing, ahead"*) on the reading sheet.

## 4. Onboarding restoration (elements lost from the spec)

Restore the full Task C §4 sequence — the build is missing screens. Must match the style-guide screens provided:

- **The Signal intro screen** (wheel with North glowing): eyebrow `WHERE YOU'RE BEGINNING`, copy: *"You're entering at The Signal — where the creative call is felt before it's named."*
- **The Signature screen**: eyebrow `YOUR SIGNATURE`, headline *"when did you arrive?"*, helper *"This anchors your timing map into your design."*, the UNLOCKS card (*your 28-year cycle · your bodygraph + type · readings keyed to your design*), fields (birth date, birth time optional, birth location), `skip · add later`.
- **The Practice screen** — the process education is essential and stays: three steps, renamed to match the actual loop — **ONE · encounter** (*a 3-minute voice guide — a threshold, not a lesson*) · **TWO · reflect** (*speak or write what's real*) · **THREE · the field guide** (*your reflections become field notes; patterns become a guide*). Closing line: *"The timing map holds all of it — a life, ever present."* (One sentence is all the map gets in onboarding; it is the advanced instrument, not the lesson.)

Order stands: hello → the Signal → signature → the map draws → the practice → begin.

## 5. Encounter flow simplification (one capture, then depth)

The default path through an encounter is now explicitly **one capture long**:

- The ⟡ screen leads with the crystallizing prompt and capture only. All other reflection prompts live behind the collapsed `NEED A WAY IN? ↓` reveal — never listed openly above/below the capture.
- After the ⟡ capture: integration and carry render as before (they are actions, not captures), each skippable with its single unhurried affordance.
- Where an encounter has more prompt material, it is offered ONCE, quietly, after the ⟡: *"there's more here, if you have time →"* (the deep-dive affordance pattern) — never as a wall of inputs.
- **Returning to add more is always possible and should be said once:** on the encounter close screen, beneath the epigraph, a small line — *"you can return to this day from the map, anytime."* Re-entry via the practice wheel (visit mode) allows more captures against the same `encounterRef`; the ambient `+` remains on all non-⟡ screens.

## 6. The counterweight becomes capturable

On the reading sheet (and the encounter's counterweight resolution screen), beneath the counterweight question: a quiet affordance — *"keep what comes →"* — opening the standard capture sheet (voice or text). The resulting fieldNote: `type: 'reflection'`, `source: 'spontaneous'`, `questionId: null`, plus one **additive v1.8 field**: `mapRef: { date: <ISO date of the position read>, phase: <its phase> } | null` (null on all other notes; no rules/index changes — clients may write it). This lets the Guide someday know which reflections the map itself provoked. No capture is ever required; the affordance is one line, not a form.

## 7. The Guide — interim value now (engine follows in Milestone D)

Until the pattern engine ships, the Guide tab must not be empty for an active user:

- **Chronological feed** of all field notes (this is free-tier canon), newest first, each showing its verbatim opening line, type chip, and source label (`reflection · the threshold · 2 days ago`).
- **Taking-root header** (client-side, counts only — no interpretation): *"N notes across M days."* plus `YOUR WORDS, RETURNING` — the most recent capture's first line, verbatim, with attribution.
- Lens rows render but read *"listening."* until Milestone D.
- This interim state must appear from the FIRST capture — it is the first-run value demonstration.

## 8. Copy — final strings for this pass

| Where | String |
|---|---|
| Signature headline | *when did you arrive?* |
| Signature helper | *This anchors your timing map into your design.* |
| Companions eyebrow | `THE CONTINUUM OF THIS MOMENT` |
| Companions link | *four companions of this moment →* |
| Scale toggle | `⤢ the practice` / `⤢ the life` |
| Future counterweight eyebrow | `THE COUNTERWEIGHT, TO COME` |
| Close-screen return line | *you can return to this day from the map, anytime.* |
| Counterweight capture | *keep what comes →* |
| Sign-in line | *already keeping a field? sign in* |

**Future-tense counterweight questions** (used when the counterweight date is after today; keyed to the counterweight's own phase — DRAFT, founder may refine):

| Phase | Question |
|---|---|
| signal | *What will be arriving then that today is already preparing?* |
| field | *What gathers now that you will be speaking then?* |
| friction | *What are you up against now that will have become material by then?* |
| voice | *What are you saying now that then will gather toward?* |

## 9. Acceptance checklist

- [ ] Tap the 2031 counterweight dot → pendulum lands at 2031; sheet describes 2031 (The Seed Remembers / arrival season) with ITS counterweight (2017, past tense).
- [ ] Wander to May 2045 → sheet shows The Telling; counterweight May 2031 with `THE COUNTERWEIGHT, TO COME` and the future-tense voice→field question.
- [ ] TODAY pill never wraps during a full drag around the spiral.
- [ ] Every header icon responds or is gone; all targets ≥ 44pt; all map text ≥ 11pt rendered.
- [ ] Pinch zooms the life spiral smoothly; double-tap resets; practice wheel unaffected.
- [ ] Full onboarding shows all screens including the Signal intro and the three-step practice education.
- [ ] ⟡ screen: one prompt, one capture, warm-ups collapsed, both capture modes toggle both ways.
- [ ] Counterweight *keep what comes →* creates a fieldNote with `mapRef` populated.
- [ ] After one capture, the Guide shows the taking-root header + feed (no "empty" state); RECENT in Notes shows the note immediately.
- [ ] Sign out → *already keeping a field? sign in* → sign in → same field returns.
