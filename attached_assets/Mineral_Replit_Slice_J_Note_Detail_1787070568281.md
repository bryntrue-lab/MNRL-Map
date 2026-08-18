# Mineral — Slice J: the note, whole (view · edit · release)

*Standing instruction applies; CS vocabulary rules standing. Scope: the Notes tab's row tap-through, one new note detail sheet, one edit mode, per-note deletion, and a two-line storage.rules fix. Nothing else — no Guide changes, no engine changes, no Settings changes.*

## 0. Context

Notes are currently visible only as two-line truncations (`numberOfLines={2}` in `app/(tabs)/notes.tsx`) with no detail view, no edit, and no per-note delete. The backend already supports all three: firestore.rules allow per-note `update` (charge-guarded) and `delete`; `updatePatterns` is `onDocumentWritten`, so edits and deletes recompute patterns automatically; `lib/firestore.ts` already exports `deleteFieldNote(uid, noteId, audioPath)` with the correct audio-first ordering. This slice is UI wiring plus one rules bug fix. The privacy policy publicly promises per-note deletion in-app — this slice makes that true.

## J1. Storage rules: deletes are currently impossible for audio (bug fix, deploy required)

In `storage.rules`, the user-captures block gates `write` on `request.resource.size` and `contentType` — on a delete, `request.resource` is null, so **every audio-object delete is denied** and `deleteFieldNote` throws on any voice note. Split the rule:

```
match /users/{uid}/fieldNotes/{noteId}/{file} {
  allow read: if request.auth.uid == uid;
  allow delete: if request.auth.uid == uid;
  allow create, update: if request.auth.uid == uid
    && request.resource.size < 25 * 1024 * 1024
    && request.resource.contentType.matches('audio/.*');
}
```

Deploy with `firebase deploy --only storage`. No other rules change.

## J2. The note detail sheet

Tapping any note row in the Notes tab opens the note whole, using the app's existing sheet presentation (the teaching-sheet model):

- **Full text**, scrollable, `bodyLarge` / `textPrimary` — the user's words are the content; no decoration, no eyebrow above them.
- **Meta line** beneath (`metadata` register): `{month day} · {lens}` — e.g. `august 15 · the signal`. If the note came from an encounter, append ` · {encounter title}`.
- **Voice notes**: if `audioPath` is set, a playback row above the meta line reusing the existing audio playback affordance (resolve via `resolveAudioUrl`). If no shared playback component exists yet, a minimal play/pause row in this sheet only — do not build a general player.
- The two-line truncated rows in the list are unchanged in appearance; they simply become tappable.

## J3. Edit

- A single whisper link in the sheet: `edit →` (linkWhisper register, one signifier).
- Tapping swaps the text block for a multiline input pre-filled with the note text, keyboard up, with `save →` and `not now` (register and pairing per the origin-edit variant precedent). Save writes the `content` field only via the existing update path — never any engine field (`charge` is server-guarded already). On success, sheet returns to reading state with updated text. On failure: `not kept — try again` (existing canon string).
- Editing a voice note edits its transcript text; the recording itself is untouched and remains playable. No re-transcription is triggered (guard: do not touch `transcriptStatus`).
- Patterns recompute on their own (`updatePatterns` on write) — no client work, no spinner; the Guide catches up within moments.

## J4. Release a note

- At the sheet's bottom, quiet and separated: `release this note` (muted destructive register — match the Settings release-this-field link treatment, not a red button).
- Confirm dialog — strings are founder-vetoable proposals, render verbatim if approved:
  - Title: `release this note?`
  - Body: `It leaves the field, and the patterns it fed let it go. There's no way back.`
  - Actions: `release` · `keep it`
- On confirm: call the existing `deleteFieldNote` (audio object first, then doc — already implemented). On success, dismiss the sheet; the list updates. On the audio-delete failure path the helper throws: surface `not released — try again` and leave the note intact (this is the helper's designed contract; do not swallow).
- Pattern reversal is automatic via `updatePatterns` on delete — verify, don't build.

## Acceptance

- [ ] Tap any note → sheet with full text (a multi-paragraph note scrolls), meta line, playback on voice notes.
- [ ] Edit → change text → save → reopened note shows new text; Guide reflects the change after recompute (spot-check one motif).
- [ ] Release a TEXT note → gone from list; a motif fed only by that note leaves the Guide after recompute.
- [ ] Release a VOICE note → succeeds (this proves J1; before the rules fix it throws) — and the audio object is gone from Storage (console spot-check).
- [ ] `not kept — try again` on airplane-mode save; `not released — try again` on airplane-mode release; note intact in both.
- [ ] Rows still truncate at two lines; Notes tab otherwise unchanged; file list confirms scope (notes tab, new sheet, storage.rules).

## Out of scope

Re-transcription; note search/filter; Guide changes; any Settings change; bulk operations.
