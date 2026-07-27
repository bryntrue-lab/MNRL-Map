# Mineral — Replit Build Task B: The Encounter Flow + Transcription Function

*Self-contained build task for the Replit agent. Prerequisite: Task A (Origin tab + schema v1.7) is merged and working. Where this document conflicts with older documents in the repo, THIS DOCUMENT WINS. The attached `Mineral_Origin_Prototype.html` demonstrates the full flow interactively — match its feel.*

**Project:** `mineral-resonance` · Expo / React Native / Firebase JS SDK v12 · expo-router · Cloud Functions (Node, Admin SDK) for transcription only.

---

## 0. Decisions already made (do not reopen)

1. **Capture is the center.** The crystallizing (⟡) capture opens the post-audio experience as its centerpiece. Everything after it is optional depth. Protect this moment above all else.
2. **Every day has an encounter** — no still-point gaps in the sequence (per Task A §0.1).
3. **Timing, not progress.** No progress bar during audio. No block-position dots. The encounter is a held space.
4. **Two capture kinds, one collection.** Crystallizing capture = `fieldNote` with `questionId` = the ⟡ prompt's id. Ambient captures = same `encounterRef`, user-chosen chip type, `questionId: null`. Never a separate collection.
5. **Clients never write `charge`.** Omit the field entirely on create (the rule requires it absent — `charge: null` will be rejected).
6. **Tabs disappear inside the encounter.** So do all progress indicators.
7. **Chapel voice** for every line of UI copy in the flow: spare, present-tense, no coaching residue, no business vocabulary. All copy in this document is final.

---

## 1. The flow (seven screens, one per state)

`Threshold → Listen → ⟡ Capture → [Hold] → Counterweight Resolution → post-capture blocks → Close`

The flow renders the encounter's `blocks[]` from Firestore — one block per screen, advancing by tap, with a quiet back affordance (subtle ‹ / swipe-right) for re-reading. The seven seeded Signal encounters each contain: a reflection block holding the ⟡ prompt, an integration block, and a carry block.

### 1a. Threshold (built in Task A — extend)
Begin now works: resolve `audioPath` → Storage download URL → buffer into `expo-av` (or `expo-audio`) → write `userEncounters/{encounterId}_t{turn}` with `status: 'in-progress'`, `startedAt: serverTimestamp()` (in visit mode: `status: 'visited'`, `visitedAt: serverTimestamp()` — see §4) → transition to Listen. Missing audio: *"This encounter isn't ready yet."*, return to map.

### 1b. Listen
Minimal: atmosphere only, a small breathing dot at center (visual proof of playback, not a control), `pause / play` toggle bottom-center (≥44pt), `skip →` bottom-right, quiet. **No progress bar, no timer.** Audio completes → 1.5s held silence → auto-advance. App backgrounded: pause and persist `audioPosition` (seconds) on the userEncounters doc; on return, resume from position — never restart.

### 1c. The ⟡ screen
The centerpiece. ⟡ glyph (small, blue-lavender `#9bb2e8` register) · eyebrow `WHAT TO KEEP` · the crystallizing prompt in ceremonial serif italic, large, generous vertical space · sub-prompt beneath in dim (when the prompt has `subtext`) · capture affordance: large **hold-to-record** button (default) with a live waveform growing as the user speaks; small toggle *"type instead"* → soft textarea, autofocus, placeholder *"when you're ready"*, then *"keep this →"*.

On completion, create the fieldNote:

```ts
{
  type: 'reflection', source: 'encounter',
  encounterRef: `${encounterId}_t${turn}`,          // the userEncounters doc id
  questionId: <the crystallizing prompt's id>,       // e.g. 'r1-crystallizing'
  captureMode: 'audio' | 'text',
  audioPath: 'users/{uid}/fieldNotes/{noteId}/audio.m4a' | null,
  content: <typed text> | null,                      // null for audio until transcription
  transcriptStatus: 'pending' /* audio */ | 'none' /* text */,
  atmosphere: <current practice phase>,
  createdAt: serverTimestamp(),
  // charge: OMITTED — never written by the client
}
```

Voice: upload the recording to Storage at the path above, then create the doc → §1d. Text: doc created with content → skip the hold, go straight to §1e.

### 1d. The beautiful hold (voice only)
Not a loading state — a ritual state. The atmosphere breathes (4s cycle); one serif line, centered: *"Holding your words."*; the ⟡ glyph at rest beneath. **No spinner, no timer.** A Firestore listener on the fieldNote watches for `transcriptStatus: 'done'` → advance to §1e with the transcribed content. **Fallback: at 60 seconds (config constant `HOLD_TIMEOUT_MS`), advance anyway**, using the ⟡ prompt itself as the woven line — the user experiences no error; the ritual completes. Also handle `'failed'` the same way, immediately. If the user leaves during the hold: on return, land at §1e (the transcription completed in the background or the fallback applies).

### 1e. Counterweight resolution
The map returns as a moment: darkened atmosphere, a cropped spiral fragment (still point, today's arc position, the counterweight position glowing in its station color — reuse Task A geometry at small scale). Near the top, one line of the user's own words in serif italic quotes — **the woven line**. Beneath: eyebrow `YOUR COUNTERWEIGHT TODAY`, the full ritual date, the counterweight question (keyed to the counterweight's OWN phase — Task A §5, worked example applies). A single `continue →`.

**Woven-line rule (v1, client-side, from `content`):** the first sentence of 4–12 words; if none, the first 8 words + ellipsis; if no content (voice fallback), the ⟡ prompt itself.

**No birth date:** skip this screen entirely — capture → §1f. The encounter completes without the map moment.

### 1f. Post-capture blocks
Render the remaining `blocks[]` after the ⟡ block (integration, carry) one per screen, using each block type's fields per schema v1.6 §1 (`title`, `instruction`, `durationLabel`, `options`, `closing`, …). Forward affordances are unhurried: *"when you're ready →"* (integration), *"return to the map →"* (carry). Persist `blockIndex` on the userEncounters doc after each advance (resume support). Deep-dive rendering: not needed (no seeded encounter has one); if `deepDive != null` ever, show the quiet branch offer *"there's more here, if you have time →"* before carry.

**Ambient capture:** a subtle `+` top-right on every block screen EXCEPT the ⟡ screen. Opens the same nine-chip capture sheet as the Notes tab (same component — do not reimplement). The resulting fieldNote carries the user-chosen `type`, the same `encounterRef`, `questionId: null`. The user returns exactly where they were.

### 1g. Close
Full-screen atmosphere; the encounter's `mapEpigraph` (fallback `subtitle`) in serif italic, centered; *"return to the map →"*. On tap:
- **Pilgrim mode:** update userEncounters `status: 'completed'`, `completedAt: serverTimestamp()`; update user doc `sequenceDay: increment(1)` (FieldValue.increment) and, when crossing a phase boundary (day 27→28 etc.), `currentPhase`; return to the Origin tab (CTA now in its COMPLETE · TOMORROW state).
- **Visit mode:** the userEncounters doc keeps `status: 'visited'` (plus `visitedAt`); **no sequence advance, no CTA change**; return to the turn view, where the day now shows its visited ring.

---

## 2. Sequence rules (exact)

- `sequenceDay` advances ONLY on an in-sequence `completed` close. One per day is the intent, but v1 does not enforce a calendar lock — if the founder completes two days in one sitting while testing, allow it.
- Completing today's encounter puts the CTA in the informational state; re-entry to today's encounter is via the turn view only (which opens it in visit mode — the completed status is not overwritten; a visit alongside is recorded via `visitedAt`).
- A single userEncounters doc may legitimately hold both `visitedAt` and `completedAt` (visited Aug 3, met in sequence Aug 11). Status precedence when writing: `completed` is terminal for the turn — a later visit updates `visitedAt` but never demotes status.

---

## 3. Transcription Cloud Function (the one server piece)

`onDocumentCreated('users/{uid}/fieldNotes/{noteId}')`, Admin SDK:

1. If `captureMode == 'audio'` and `transcriptStatus == 'pending'`: fetch the audio at `audioPath` from Storage, transcribe with **Google Cloud Speech-to-Text** (latest long model, language `en-US`, punctuation on), write `content` = transcript, `transcriptStatus: 'done'`. On any failure: `transcriptStatus: 'failed'` (the client falls through gracefully — never leave `pending` forever; wrap in try/catch).
2. Text captures (`'none'`): do nothing.
3. Do NOT compute `charge` (stays null-by-absence). Do NOT write patterns. The pattern engine is a separate future prompt.

Deploy from Replit per the v1.6 §12 wiring (`firebase.json` already present; `npx firebase deploy --only functions --project mineral-resonance`). Keep the function's IAM to what functions get by default; the service-account credential in Replit Secrets is for the seed script, not this.

*(Optional, same file, if trivial: the completion trigger from v1.6 §6 — on userEncounters update to `completed`, increment `users/{uid}.completedEncounterCount`. Nothing reads it yet; skip if it adds friction.)*

---

## 4. Edge cases (handle all)

- **Leave during audio** → pause, save `audioPosition`; CTA reads `CONTINUE`; reopening resumes the Listen screen at position.
- **Leave after capture, before close** → `status` stays `in-progress`, `blockIndex` persisted; reopening lands on the saved block screen.
- **Transcription > 60s or failed** → §1d fallback; the ritual completes; the note's transcript arrives later on its own.
- **Visit mode always writes `visitedAt`** on first visit only (don't overwrite an existing `visitedAt`).
- **No birth date** → no counterweight screen; everything else identical.
- **Airplane mode / offline capture** → Firestore offline persistence handles the doc; the audio upload retries when online; the hold's 60s fallback covers the wait. Do not block the flow on connectivity.
- **Double-tap protection** on Begin and on capture completion (single-flight guards).

---

## 5. Acceptance checklist

- [ ] Full pilgrim pass on Day 1 with seeded content: Threshold → audio plays from Storage → pause/resume/skip work → held silence → ⟡ screen shows `r1-crystallizing` prompt + subtext → text path: fieldNote correct (`charge` absent — verify in Rules Playground that a create WITH charge is rejected), woven line obeys the 4–12-word rule → counterweight date calendar-exact, friction/… question keyed to the counterweight's own phase → integration & carry render from `blocks[]` → close shows the epigraph → `sequenceDay` incremented, CTA flips to COMPLETE · TOMORROW.
- [ ] Voice path: recording uploads to `users/{uid}/fieldNotes/{noteId}/audio.m4a`; doc `pending`; hold breathes; transcription function flips it `done` and the woven line uses the user's words; with the function disabled, the 60s fallback completes the ritual with the ⟡ prompt.
- [ ] Visit pass from the turn view: `visited` + `visitedAt` written; sequence pointer unmoved; visited ring appears; a completed day revisited keeps `completed` status.
- [ ] Resume: kill the app mid-audio and mid-blocks; both resume in place via `audioPosition` / `blockIndex`.
- [ ] Ambient `+` opens the Notes tab's own capture sheet component; resulting note has chip type, `encounterRef`, `questionId: null`.
- [ ] No progress indicators anywhere in the flow; tab bar hidden throughout; back affordance is quiet and works.
- [ ] Transcription function deployed; a `failed` status (force one with a bad audio path) degrades gracefully.
