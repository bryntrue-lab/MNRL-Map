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
