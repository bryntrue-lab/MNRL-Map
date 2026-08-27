# Mineral — Slice L: the reading (founder-gated)

*Standing instruction applies; CS vocabulary rules standing. Scope: one callable function, one Firestore subcollection + rules entry, one whisper + one sheet in the Guide, one user-doc flag. Nothing else changes — no lens screens, no engine changes.*

## 0. Why

The Guide counts faithfully, but counting returns fragments. What the founder is missing in her own field — nineteen detailed notes in — is a voice that reads *across* the notes and says what it sees. This slice adds that voice as a ritual: user-initiated, once a day, written by the generation pipeline from the user's actual notes, in the Guide's register. **It is gated to the founder's account only.** Nothing about it is visible to any other user, and no other user's note text can reach the pipeline (server-enforced, not just UI-hidden). Before this ever widens: consent flow + privacy policy amendment (note text to OpenAI is a new disclosure — the current policy covers audio only).

## L1. The flag

`users/{uid}.readingsEnabled: boolean` — absent/false for everyone. The founder sets it to `true` on her own user doc in the Firestore console by hand. Firestore rules: this field joins the server-controlled list (client create/update must not set or change it — same pattern as `charge`).

## L2. The callable — `requestReading`

`functions/index.js`, callable, auth required:

1. **Gate first, server-side:** load `users/{uid}`; if `readingsEnabled !== true` → `permission-denied`. This check is the privacy boundary — it runs regardless of what any client sends.
2. **Rate:** if the newest doc in `users/{uid}/readings` is less than 20 hours old → `resource-exhausted` (client shows the rest line, L4).
3. **Gather:** the most recent 40 field notes (content, type, encounter, createdAt) + the three pattern docs + note-count/day-count. If fewer than 7 notes → `failed-precondition`.
4. **Compose:** system prompt from `practitionerContent/reading_prompt` (kind `'reading_prompt'`, founder-editable; fall back to the built-in default in §L5 if the doc is missing). User message: the notes (dated, typed) + pattern summaries. Existing OpenAI secret; text model (same config pattern as transcription); JSON response: `{"paragraphs":[{"spans":[{"text":"...","quote":false}]}],"question":"..."}` — `quote:true` spans are verbatim words of the user's. If JSON parsing fails, fall back to treating the raw text as one plain paragraph.
5. **Store:** `users/{uid}/readings/{autoId}`: `{ paragraphs, question, createdAt, noteCount }`. Return the doc id.
6. Firestore rules: `match /readings/{id} { allow read: if request.auth.uid == uid; allow write: if false; }` (server writes via Admin SDK).

## L3. The whisper

Guide footer, beneath `about the guide →`, rendered ONLY when the signed-in user's doc has `readingsEnabled === true` **and** the field has ≥ 7 notes:

`ask for a reading →` *(linkWhisper register)*

## L4. The sheet

Tapping opens the sheet (existing SheetShell, same as the teaching sheet):

- Pending: one line, `reading your field…` *(serifMedium, 0.85 white — vetoable)* while the callable runs.
- The reading: eyebrow `A READING` + date beneath (`metadata`: `august 22 · nineteen notes`). Paragraphs in `bodyLarge` sans `textSecondary`; `quote:true` spans render inline in the serif (serifSmall register, 0.85) — **the user's own words are the only serif in the reading.** The closing question renders as its own serif line (`serifMedium`) after a wider gap.
- Same-day re-ask (`resource-exhausted`): show the most recent stored reading with the line `the field rests until tomorrow.` *(metadata register — vetoable)* above it.
- Failure: `the reading didn't arrive — ask again.` *(vetoable, patterned on `not kept — try again`)*
- Re-opening the sheet later the same day shows the stored latest reading (no new call).

## L5. The default prompt (seed verbatim into `practitionerContent/reading_prompt`; founder edits in console)

> You are the voice of Mineral's Field Guide — an old, kind, unhurried practice companion. You are given a person's recent field notes (their private reflections, dated and typed) and the patterns the guide has counted. Write them a reading.
>
> Rules, absolute: Work only from what is in the notes — never invent events, feelings, or facts. Quote their exact words often; quoted spans must appear verbatim in a note. Never advise, prescribe, diagnose, flatter, or predict. Never mention being an AI, a model, or a system. No therapy language, no productivity language, no exclamation marks. Do not summarize note by note — read across them: name what returns, what has shifted since the earliest notes, what sits next to what. It is enough to notice; you do not need to resolve.
>
> Form: three short paragraphs at most, under 180 words total, then exactly one quiet question the notes themselves seem to be asking. Lowercase-comfortable, present tense, plain words.

## Acceptance

- [ ] Founder's account (flag set by hand): whisper renders → sheet → a reading arrives, quotes are verbatim from her notes, serif/sans registers as specified; question renders as its own serif line.
- [ ] Second ask same day: rest line + latest reading, no new generation (verify no new OpenAI call in function logs).
- [ ] A second test account WITHOUT the flag: no whisper anywhere; calling `requestReading` directly (e.g. from the web console) returns `permission-denied` — this item is the privacy gate and must be demonstrated, not assumed.
- [ ] Fresh account with < 7 notes and the flag: whisper hidden.
- [ ] Rules deploy confirmed; file list: functions, rules, Guide footer, one new sheet.

## Out of scope

Any exposure beyond the founder's account; consent UI; privacy-policy changes (required before widening — tracked, not in this slice); reading history UI; Slice K's lens work (separate, pending canvas review).
