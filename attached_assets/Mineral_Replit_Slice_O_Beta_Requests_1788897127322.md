# Mineral — Slice O: beta requests (landing form → Firestore → the digest)

*Standing instruction applies. Scope: one public HTTPS function, one rules block, one digest section. No app code. The landing page itself is hosted on madebymineral.com and is NOT in this repo — the checkpoint must report the deployed function URL so the founder can paste it into the page.*

## O1. The endpoint — `betaRequest` (HTTPS, public, no auth)

- Accepts POST JSON: `{ email, work, website }`. CORS: allow origins `https://madebymineral.com` and `https://www.madebymineral.com` only.
- **Honeypot:** `website` is a hidden field humans never fill. If non-empty → respond 200 as if accepted, write nothing.
- Validate: email matches a sane pattern, ≤ 200 chars; `work` ≤ 500 chars (trim; may be empty). Reject invalid with 400.
- Write to `betaRequests/{docId}` where docId = the normalized (lowercased, trimmed) email — **idempotent by design**: a repeat submission updates `lastSeenAt` but keeps the original `createdAt` and never duplicates. Fields: `{ email, work, createdAt, lastSeenAt, status: "new", source: "landing" }`.
- Respond 200 `{ ok: true }`. No other data returned.
- firestore.rules: `betaRequests` → `allow read, write: if false;` for clients (function writes via Admin SDK).

## O2. Digest section — "at the door"

Add to `founderDigest` (Slice M), after "the field, overnight":

```
at the door
  2 requested access overnight · 5 awaiting invites
  jane@example.com — "finishing a poetry collection"
  sam@example.com — (no note)
```

- Lists requests with `createdAt` in the last 24h: email + the `work` note truncated to 80 chars. Second line counts all `status: "new"` docs.
- No requests overnight and none pending → section renders `at the door — quiet`.
- **M4 amendment (deliberate):** beta-request contact info is submitted *for the purpose of being contacted* — it may appear in the digest. The prohibition on user emails/uids/note-text from the app's field data is unchanged and still absolute.

The founder invites people by replying from her mailbox with the TestFlight link, then flips the doc's `status` to `"invited"` in the console so the pending count stays honest. (No automation of the invite itself in this slice.)

## Acceptance

- [ ] `curl` POST with a valid email → 200, doc appears with `status: "new"`; repeat POST → no duplicate, `lastSeenAt` updates.
- [ ] Honeypot filled → 200, no doc.
- [ ] Invalid email → 400, no doc.
- [ ] Browser request from an allowed origin succeeds; from another origin is CORS-blocked.
- [ ] Client read/write on `betaRequests` denied (rules test).
- [ ] Next digest shows "at the door" with the test entries; quiet form when none.
- [ ] **Checkpoint reports the exact deployed function URL** (the founder pastes it into the landing page's `BETA_ENDPOINT`).
- [ ] File list: functions, firestore.rules. Nothing else.

## Rider — pause the passage queue. Disable draftFieldPassages's schedule (comment out the schedule/early-return at the top of the function and deploy — whichever is cleaner; report which). Do NOT delete, modify, or purge any existing passages or drafts — they're awaiting founder review. The queue stays paused until Slice G2b re-enables it with its guardrails.

That freezes the situation exactly as it stands: your 81 drafts stay put for review on your schedule, nothing new piles on top, the digest's number stops climbing, and the approved-only render gate keeps protecting users throughout (that part was never at risk).
