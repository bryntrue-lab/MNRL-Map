---
name: Subscription product policy
description: Founder-supplied subscription scope, access promises, pricing intent, and inconsistent draft wording.
---

The founder's latest instruction supersedes conflicting draft notes: $108 per year and $111 monthly, as written. Do not silently change monthly to $11. Confirm the unusually large monthly amount before creating or changing store products. One subscription group, Mineral Practice, with annual and monthly products; one practice entitlement. The existing eighth-encounter gate is the paywall, after seven free encounters, not an elapsed calendar-week timer. No introductory product trial; the launch promotion is one free month via monthly-product offer codes.

**Why:** The founder wants recurring App Store revenue without stacking a subscription trial on the existing free experience.

**How to apply:** The founder explicitly said conflicting draft notes are irrelevant and inaccurate. Do not reuse their prices, savings claims, or draft paywall copy. Use actual localized store prices for billing disclosures and obtain approval for corrected user-facing copy.

Lapse closes only new encounters: notes and Guide remain readable. There is no founding circle and no founding-circle complimentary-access requirement.

**Why:** The founder's explicit promise is "lapse never locks a person out of their own words."

**How to apply:** Preserve this boundary in client and server authorization. Do not grandfather testers or implement complimentary access based on the superseded draft. Protect entitlement grants from client edits.

RevenueCat is the purchase authority; the plan calls for a server-managed Firebase entitlement projection used by client gates and rules, with purchases tied to Firebase UID.

**Why:** The founder wants access decisions consistent with the app's existing server-authoritative model.

**How to apply:** Treat Firebase state as a verified projection, never an independent purchase authority. The founder explicitly approved adding secure event processing, reconciliation, expiry handling, and purchase/restore synchronization. Older build-number labels in the plan are superseded by version-based release planning.
