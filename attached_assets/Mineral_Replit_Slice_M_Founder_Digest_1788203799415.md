# Mineral — Slice M: the founder digest (daily email)

*Standing instruction applies. Scope: one scheduled Cloud Function, the Trigger Email extension's mail-collection contract, one config value. No app code, no rules changes beyond what's specified, no user-facing anything — this feature's only user is the founder.*

## 0. What it is

One email, every morning, telling the founder what awaits her and how the field fared overnight — so nothing pools silently in the console and the day starts with one read instead of five checks. It always sends, even on a quiet day: the email doubling as a heartbeat (no digest = the pipeline itself is broken, which is worth knowing by breakfast).

## M1. Delivery — Trigger Email extension (console task, founder)

Install the official `firebase/firestore-send-email` extension on the project, configured to watch collection `mail`, with SMTP credentials for the founder's mailbox (or a Gmail app password). Documented in the checkpoint report step by step. The digest function only ever writes `mail` docs; the extension does the sending.

- Firestore rules: `mail` is server-only — `allow read, write: if false;` for clients (add to firestore.rules).
- Founder's address comes from a functions config value / env (`FOUNDER_DIGEST_EMAIL`) — not hardcoded in source.

## M2. The function — `founderDigest`

Scheduled daily at **12:00 UTC** (7:00 AM central — founder can retune the cron later). Gathers, via Admin SDK, and tolerates every section failing independently (a section that errors renders as `{section}: unavailable` rather than killing the digest):

1. **The field, by the numbers (last 24h + totals):** new accounts (Auth `listUsers`, creationTime within 24h) · total accounts, split anonymous vs. kept (email present) · encounters completed in 24h · notes captured in 24h, voice vs. typed (COUNTS ONLY — see M4) · morning-call opt-ins total (users docs with `morningCall` set).
2. **Awaiting the founder:** pending field-passage drafts — count + their keys (reads `practitionerContent` docs for `passages[].status == "draft"`; if the passages schema doesn't exist yet because Slice G2 hasn't landed, the section renders as `the field queue is not yet running` — this slice must NOT depend on G2 landing first).
3. **Health:** field notes with `transcriptStatus == "pending"` older than 1 hour (stuck transcriptions) + any with a failed status — counts, and the age of the oldest stuck item.
4. **Readings (when present):** count of readings generated in 24h (`users/*/readings`); section omitted if the collection is empty project-wide.

## M3. The email itself (register: quiet operations, not marketing)

- Subject: `mineral · {weekday} — {n} awaiting you` (or `mineral · {weekday} — a quiet day` when section 2 is empty and health is clean).
- Plain text, short lines, sections in M2's order, no HTML styling beyond line breaks. Example body:

```
the field, overnight
  2 new arrivals · 14 fields total (9 kept, 5 unnamed)
  11 encounters completed · 16 notes (12 voice, 4 typed)
  morning call: 8 opted in

awaiting you
  3 passages drafted: support, burnout, door
  → review in the Firestore console (practitionerContent)

health
  transcription: clear
```

## M4. Privacy rules for the digest (non-negotiable)

Counts, keys, and status words only. **Never** any user's note text, transcript fragment, or reading text; never uids or user emails in the email body; never per-user breakdowns. The digest crosses email infrastructure — it carries operations arithmetic, not field content. (Passage keys are shared single words, already ruled acceptable for the G2 queue; same ruling covers listing them here.)

## Acceptance

- [ ] Extension installed and a manually-written `mail` doc arrives at the founder's inbox (proves delivery before the function is trusted).
- [ ] Trigger the function manually: digest arrives with real numbers; every count spot-checks against the console.
- [ ] Force one section to fail (e.g. temporarily bad collection name in a test run): digest still arrives, section reads `unavailable`.
- [ ] A quiet-day run sends with the quiet subject line.
- [ ] `mail` collection unreadable/unwritable from a client (rules test).
- [ ] Body contains no note text, no emails, no uids — reviewed against M4 with real data present.
- [ ] File list: functions (one new scheduled function), firestore.rules (mail block), config docs. Nothing in the app.

## Out of scope

Any user-facing surface; push notifications; weekly summaries or charts; the G2 queue itself (separate slice — the digest reports on it whenever it exists).
