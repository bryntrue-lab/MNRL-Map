# Mineral Firebase functions

## Founder digest and field-draft email delivery

The scheduled functions write standard Trigger Email extension documents to the
Firestore `mail` collection. Recipient addresses are not stored in source.

Required Firebase configuration:

1. Set the `FOUNDER_DIGEST_EMAIL` Functions string parameter during deployment.
2. Install `firebase/firestore-send-email`.
3. Configure the extension to watch the `mail` collection.
4. Configure SMTP in Firebase Console using the founder-owned mail provider.
   Never commit SMTP credentials or paste them into source files.
5. Before relying on either schedule, create one manual `mail` document using
   the same `to` and `message: { subject, text }` shape and confirm delivery.

Schedules:

- `fieldPassageQueue`: `0 11 * * *`
- `founderDigest`: `0 12 * * *`
- `weeklyUsageReport`: Fridays at `0 7 * * 5` in `America/Chicago`

The weekly report is aggregate-only. Its trailing windows end at the scheduled
event's `scheduleTime` (not retry time), use UTC calendar days, and never read
note bodies. It writes a deterministic `mail` document so retries cannot queue
the same report twice. Auth figures count accounts, not people; development and
production share data without an exclusion marker, and Mineral does not track
session duration.

On a day that creates field-passage drafts, the queue writes an immediate draft
notice and the digest still writes its independent daily message.

## Beta autoapproval: generated offering copy only

The server-only shared document `practitionerContent/field_generation_policy`
has this configuration (the explicit default is **false**):

```json
{
  "kind": "field_generation_policy",
  "betaAutoApproveGeneratedOfferings": false
}
```

This document is intentionally not part of the general content seeder. An
authorized operator should create it **create-only** if absent, without replacing
an existing policy. After offline tests and the authorized narrow deployment,
the operator may explicitly set the boolean to `true` for beta. Missing policy,
wrong kind, missing boolean, and non-boolean values all retain draft-only
generation. A failed policy read surfaces as a generation/storage error rather
than authorizing approval. Keep this kind out of client-readable rules
whitelists; clients cannot write practitioner content.

Only `fieldPassageQueue` changes: the model parser always produces a draft,
and its final Firestore transaction reads the policy and stores the one new
generated passage with `status: "approved"` when enabled (`"draft"` otherwise).
It retains `source: "generated"`, `text`, `locator`, and `createdAt`. With beta
enabled and no competing copy, the offering document gets `status: "approved"`
so an empty legacy word document marked draft cannot hide its approved passage.
For motif/resistance only, missing usable top-level `text` is filled from that
approved passage so the unchanged server and live Guide readers can use it.
Existing founder text, any existing passages (including drafts/rejections),
and explicitly rejected documents are never overwritten or bulk-approved.
Disabling beta affects future publications only; it does not revoke prior
approval or promote existing drafts.

The ten-passage/ten-attempt UTC daily limits, failed-attempt accounting,
concurrent lease, conservative legacy counter migration, established-pattern
ranking, lexicon/word allowlist, and single-key-only model privacy boundary
are unchanged. The policy does not approve or expand resistance vocabulary,
write proposals or lexicon entries, change approved-only readers, or bypass any
reading or vocabulary approval gate. Queue metrics keep counting generated
passages in every status; only drafts count as pending review.

Narrow function deployment when authorized:
`firebase deploy --only functions:mineral:fieldPassageQueue`.
No app, pattern-engine, vocabulary, or digest export deployment is required by
this switch. No deployment or live policy mutation is performed by the tests.

Offline focused tests:
`cd functions && node fieldQueue.test.js && node patternOfferings.test.js`.
Full offline Functions suite: `cd functions && npm test`.

## Resistance vocabulary: explicit founder review

`draftResistanceVocabulary` and `approveResistanceVocabulary` require a signed-in
Firebase Auth caller with the **server-only custom claim**
`fieldContentAdmin === true`. An operator must grant this claim only to the
user-confirmed founder UID, preserving other claims, then the founder must
refresh their ID token. `readingsEnabled`, mail recipient addresses, and
client-written roles do not authorize content administration.

Drafting reads only `practitionerContent/resistance_resistance`. It must have
`kind: "offering"`, `keyType: "resistance"`, `status: "approved"`, and the exact
founder-approved top-level `text`. No private notes or patterns enter the AI
request. Vocabulary generation is separate from the passage budget and limited
to one invocation per UTC day, including failed attempts; leases prevent
concurrent invocations. A proposal has at most three keys, twelve terms per key,
and remains inactive in `resistanceVocabularyProposals/{proposalId}`.

Run `node scripts/resistance-vocabulary.cjs --help` for exact commands. Set
`FIREBASE_PROJECT_ID` and a fresh `MINERAL_FOUNDER_ID_TOKEN` locally; do not commit
or share the token. The CLI uses authenticated callables, not an Admin SDK
rules bypass:

1. `node scripts/resistance-vocabulary.cjs draft > /tmp/resistance-draft.json`
2. `node scripts/resistance-vocabulary.cjs review /tmp/resistance-draft.json`
3. `node scripts/resistance-vocabulary.cjs approve /tmp/resistance-draft.json --dry-run`
4. Only after reviewing **every exact key and term**:
   `node scripts/resistance-vocabulary.cjs approve /tmp/resistance-draft.json --approve 1`
   (replace `1` only if the reviewed proposal's version changes).

The Console can inspect the proposal collection, but changing a draft or
manually setting its status is not the approval workflow. Approval requires the
exact proposal ID, version, content hash, and explicit confirmation. Client
writes to proposals are denied by the rules' default deny; lexicon writes are
also denied. Existing lexicon keys are never replaced, and collisions abort the
whole approval. No offering prose or passages are written by these functions.
The approved terms use the existing engine's **stemmed phrase matching**, not a
new exact-string-only matcher.

Approval rebuilds **only the authenticated founder's** patterns immediately.
Other accounts pick up vocabulary on subsequent note writes or their existing
self-only backfill; there is no full-user fanout. If rebuilding fails after
approval, retry the same exact approval to rebuild without duplicating lexicon
entries. No detector terms are approved by deployment alone.

Offline focused tests: `node --test functions/resistanceVocabulary.test.js`.
