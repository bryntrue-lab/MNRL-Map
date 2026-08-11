---
name: practitionerContent read rules gate by kind
description: New practitionerContent doc kinds are unreadable by clients until firestore.rules whitelists the kind.
---

**Rule:** `firestore.rules` allows authenticated reads of `practitionerContent` only for whitelisted `resource.data.kind` values (currently `teaching`, `counterweight_pools`). Any new founder-editable content kind needs a rules amendment + `firebase deploy --only firestore` or the client `getDoc` silently permission-denies and falls back forever.

**Why:** Slice F6 review caught counterweight pools seeded but unreadable — the fallback masked the failure completely.

**How to apply:** When adding a practitionerContent doc kind: update the rules whitelist, deploy rules (recipe in firebase-deploy-limits.md), and remember client fallbacks hide rule failures — verify the read path, not just the seed.

Related F3 lesson: a post-⟡ block whose *type* the flow can't render (e.g. `practice` in "the-soul-has-a-posture") produced the blank screen — content can be non-empty yet unrenderable; filter by renderability, not just empty text. Stray empty encounter doc `UcjoYHDHmv3wPB70edEb` exists in live `encounters` (no title/blocks).
