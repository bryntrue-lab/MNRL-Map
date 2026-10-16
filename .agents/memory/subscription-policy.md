---
name: Subscription product policy
description: Founder-supplied subscription scope, access promises, pricing intent, and inconsistent draft wording.
---

The supplied Subscription Prep Plan locks an annual $108 anchor (approximately $9/month, actual Apple price to be selected) and an $11 monthly companion. One subscription group, Mineral Practice, with annual and monthly products; one practice entitlement. The existing eighth-encounter gate is the paywall, after seven free encounters, not an elapsed calendar-week timer. No introductory product trial; the launch promotion is one free month via monthly-product offer codes.

**Why:** The founder wants recurring App Store revenue without stacking a subscription trial on the existing free experience.

**How to apply:** Do not reopen these product choices unnecessarily. Do not ship the document's contradictory draft annual "$11 a month" line, monthly "$9.99" renewal claim, or approximately 10% savings claim. The annual versus monthly intent yields approximately 18% savings; use actual localized store prices for billing disclosures and obtain approval for corrected user-facing copy.

Lapse closes only new encounters: notes and Guide remain readable. Existing testers and founding members are to receive complimentary access and never see the paywall.

**Why:** The founder's explicit promise is "lapse never locks a person out of their own words."

**How to apply:** Preserve this boundary in client and server authorization. Confirm the exact eligible founding cohort and duration rather than granting access to every existing account. Protect entitlement grants from client edits.

RevenueCat is the purchase authority; the plan calls for a server-managed Firebase entitlement projection used by client gates and rules, with purchases tied to Firebase UID.

**Why:** The founder wants access decisions consistent with the app's existing server-authoritative model.

**How to apply:** Treat Firebase state as a verified projection, never an independent purchase authority. Include secure event processing, reconciliation, expiry handling, and purchase/restore synchronization. Older build-number labels in the plan are superseded by version-based release planning.
