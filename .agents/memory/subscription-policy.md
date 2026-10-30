---
name: Subscription product policy
description: Founder-supplied subscription scope, access promises, pricing intent, and inconsistent draft wording.
---

The founder's latest approved US prices are $107.99 annually and $12.99 per month. These supersede the earlier $108/year and $11/month targets and all conflicting draft prices. This records the founder's pricing decision, not independent verification of the live Apple product duration or mappings. One subscription group, Mineral Practice, with annual and monthly products; one practice entitlement. The existing eighth-encounter gate is the paywall, after seven free encounters, not an elapsed calendar-week timer. No introductory product trial; the launch promotion is one free month via monthly-product offer codes.

**Why:** The founder wants recurring App Store revenue without stacking a subscription trial on the existing free experience.

**How to apply:** The founder explicitly said conflicting draft notes are irrelevant and inaccurate. Do not reuse their prices, savings claims, or draft paywall copy. Use actual localized store prices for billing disclosures and obtain approval for corrected user-facing copy.

Lapse closes only new encounters: notes and Guide remain readable. There is no founding circle and no founding-circle complimentary-access requirement.

**Why:** The founder's explicit promise is "lapse never locks a person out of their own words."

**How to apply:** Preserve this boundary in client and server authorization. Do not grandfather testers or implement complimentary access based on the superseded draft. Protect entitlement grants from client edits.

RevenueCat is the purchase authority; the plan calls for a server-managed Firebase entitlement projection used by client gates and rules, with purchases tied to Firebase UID.

**Why:** The founder wants access decisions consistent with the app's existing server-authoritative model.

**How to apply:** Treat Firebase state as a verified projection, never an independent purchase authority. The founder explicitly approved adding secure event processing, reconciliation, expiry handling, and purchase/restore synchronization. Older build-number labels in the plan are superseded by version-based release planning.

Reuse the existing RevenueCat membership entitlement rather than creating a second entitlement merely to obtain the name `practice`.

**Why:** The intended access level is one membership; a second entitlement would split product mappings and purchase validation unnecessarily.

**How to apply:** Keep client and server pointed at the same live entitlement. Only the approved Apple annual/monthly products grant this membership; retain unrelated Test Store setup without displaying lifetime offers in the paid app.

The founder supplied final subscription and deletion screen wording directly, replacing the proposed batch. Preserve its sentence case, punctuation, and wording; use store-localized price values in the annual/monthly slots.

**Why:** The founder rejected the earlier proposed wording and provided the complete screen-state copy instead.

**How to apply:** Do not reintroduce the earlier “seven mornings” draft or lowercase the approved copy through shared button styles. Reuse existing approved deletion-error copy rather than mislabel deletion failures as subscription failures.
