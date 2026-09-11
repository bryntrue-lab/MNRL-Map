# Mineral — Slice P: a reflection · a letter (rename + the human funnel, v0)

*Standing instruction applies; CS vocabulary rules standing. Scope: string renames on the existing reading feature, one new whisper + request sheet, one Firestore collection + rules block, one digest line. NO payments, NO in-app sharing of notes, NO new access to any user's field — the app's job ends at the request.*

## P1. Rename the automated feature — "a reflection"

The Slice L feature keeps its exact mechanics (founder-flag gate, once daily, server-side `requestReading`, quotes-in-serif) and changes only its clothes:

- Whisper: `ask for a reading →` → **`a reflection →`**
- Sheet eyebrow: `A READING` → **`A REFLECTION`**
- New metadata line beneath the reflection's closing question (`metadata` register, `textMuted`): **`read by the guide — pattern, not practitioner.`**
- Pending line `reading your field…` → **`the guide is reflecting…`** *(vetoable)*; rest line and failure line keep their existing forms with "reflection" substituted: `the field rests until tomorrow.` (unchanged) · `the reflection didn't arrive — ask again.`
- Internal names (collection `readings`, callable `requestReading`) unchanged — this is a copy rename, not a refactor.

## P2. The letter — request only (v0)

- New whisper in the Guide footer, beneath the reflection's (order: reflection, letter, about the guide): **`request a letter →`**
- Visibility: signed-in users with an email (kept field) AND ≥ 15 notes. Others never see it.
- Tapping opens a sheet (SheetShell):
  - Eyebrow `A LETTER` · title line (`serifMedium`): **`your field, read by hand.`**
  - Body (`bodyLarge`, `textSecondary`), verbatim, vetoable: `A letter is written by Bryn — the practitioner behind Mineral — personally, one at a time. Nothing in your field is shared by asking: she writes to you first, and you choose what to share with her, in your own words, by reply.`
  - Primary: `request →`. On success the sheet swaps to: **`asked. a letter begins with hers — watch your inbox.`** *(vetoable)*
  - Failure: `not asked — try again.` *(patterned on canon)*
- The request writes `letterRequests/{uid}`: `{ email (from auth), noteCount, dayCount, createdAt, status: "new" }` — one doc per user, idempotent (re-request updates `lastAskedAt`, never duplicates). Client write via a small callable (`requestLetter`, auth required — server stamps the email from the token; client sends nothing).
- firestore.rules: `letterRequests` → client `read, write: if false;`.
- **Hard boundary (restate in code comments):** this slice grants the practitioner NO access to any user's notes. The doc carries counts and the email only.

## P3. Digest line

In `founderDigest`, within "awaiting you": `{n} asked for a letter: jane@example.com (34 notes · 41 days), …` — requests with `status: "new"`. Founder replies from her mailbox; flips status to `"answered"` in the console. Quiet when none.

## Acceptance

- [ ] Reflection surfaces show the new strings; the notation line renders beneath the closing question; mechanics unchanged (founder flag, rate limit intact).
- [ ] Letter whisper: hidden for anonymous users and for kept users under 15 notes; visible above; sheet copy verbatim; request → doc appears with correct email/counts; re-request doesn't duplicate.
- [ ] `letterRequests` unreadable/unwritable from clients (rules test); the callable rejects unauthenticated calls.
- [ ] Digest lists a test request with email + counts; founder flips status → next digest drops it.
- [ ] Grep: nothing in this slice reads any user's `fieldNotes` beyond the pre-existing count.
- [ ] File list: Guide footer, two sheets (one edited, one new), one callable, rules, digest function. Nothing else.

## Out of scope (deliberately, until letters prove demand)

Payments anywhere in the app; in-app sharing of notes with the practitioner (rules + consent UI + privacy-policy amendment when it comes); scheduling/recurrence; widening the reflection beyond the founder flag (separate decision with its own consent work).
