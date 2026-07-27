---
name: Profile cache Timestamp revival
description: UserContext JSON-caches the profile; Firestore Timestamps must be revived on hydration or cold starts crash.
---

# AsyncStorage profile cache degrades Timestamps

UserContext caches the user profile in AsyncStorage as JSON (cache-first cold start).
A Firestore `Timestamp` survives the round-trip only as a plain `{ seconds, nanoseconds }`
object — calling `.toDate()` on it crashes the app (error boundary on reload; found by e2e,
not by the first-session test, because the first session always renders from the live snapshot).

**Rule:** every Timestamp field on the user doc must be listed in `TIMESTAMP_FIELDS`
inside UserContext so `reviveProfile()` reconstructs real `Timestamp` instances on hydration.

**How to apply:** when schema work adds a Timestamp field to the user doc, add it to that
list in the same change. When consuming other JSON-cached Firestore data, assume Timestamps
are plain objects unless a reviver runs. Cold-start/reload testing catches this class of bug;
first-session testing does not.
