# Mineral — Subscription Prep (build 14, the real launch)

*Decisions locked 2026-10-07: $108/yr anchor ($9/mo framing; take Apple's nearest price point, likely $107.99, and keep "108" as the story) · monthly companion $11 · paywall = the existing gate at the 8th encounter (seven free mornings) · public launch moves to build 14 — build 13 releases quietly when approved (store page live, App Check re-soak, founding circle installs from the store; no announcement) · community launch includes a one-free-month promo code.*

---

## 1. Start today (zero code, longest lead times)

1. **Paid Apps Agreement** — App Store Connect → Business → agree, then complete **banking** (LLC account) and **tax** (W-9) forms. Verification takes days; nothing ships without it. ← the long pole
2. **DSA trader status** — paid apps in the EU require registering as a trader: your business address and contact become visible on the EU store page. Decide what address represents Technofisch Design Studio LLC publicly (registered-agent address if you don't want your home listed). The non-trader status that was fine for a free app ends here.
3. **RevenueCat account** — free tier covers launch scale. Create the project, note the API key; its webhook URL becomes the App Store Server Notifications URL later.

## 2. App Store Connect configuration (after the agreement clears)

- **Subscription group:** one group — "Mineral Practice." Two auto-renewables:
  - `mineral_annual` — $108/yr (display: "$9/month, billed yearly") — **the primary**
  - `mineral_monthly` — $11/mo — the companion that makes annual obvious (annual saves ~10% and is the committed gesture)
- Localized display name + description per product; **review screenshot** of the paywall (required — take it from the dev build once the paywall exists).
- **No introductory free trial on the products themselves** — the app already gives seven free mornings; stacking a trial on top muddies the gate. The free month lives in offer codes instead:
- **Offer codes:** on `mineral_monthly`, create a custom-code offer — one month free, custom code (e.g. `THRESHOLD` or `FOUNDING`), set quantity and redemption window. This is the community-launch gift: redeemers get month one free, then $9.99/mo unless they switch to annual. (Codes are per-product and capped; create a second batch rather than one huge pool.)
- **App Store Server Notifications** (the section we skipped at submission): Production + Sandbox URLs → RevenueCat's webhook URL. **App-specific shared secret** → generate, paste into RevenueCat.

## 3. The next build (Replit)

Native change (new fingerprint — expected):

1. **`react-native-purchases`** (RevenueCat SDK). Configure with the API key; identify the user with the Firebase UID so entitlements follow the account, not the device.
2. **One entitlement: `practice`.** RevenueCat webhook → Cloud Function → writes `entitlement: "practice"` (+ expiry) onto the user's profile doc. **Firestore rules and the client gate read the profile field, not the SDK** — server-truth, consistent with everything else in the architecture.
3. **The gate screen at encounter 8** becomes the paywall. Apple compliance requirements on that screen: price AND billing period explicit, a **Restore Purchases** control, links to Privacy Policy and Terms (Apple's standard EULA is fine). Draft copy, founder-vetoable, in voice:

   > seven mornings, kept.
   > the practice continues with membership.
   > **$11 a month, billed once a year — 108.**
   > [continue the practice →]
   > or $11 month by month
   > restore purchases · privacy · terms
   >
   > *(no countdown, no crossed-out prices, no "limited time." the gate is the ask, made once, in the open.)*

4. **Comp the circle:** grandfather existing testers + founding members via RevenueCat granted entitlements (dashboard, no code) or the profile flag — they were here before the gate; they never see it.
5. **Manage-subscription link** in Settings (deep link to Apple's management page) — reviewers look for it.
6. Sandbox test matrix: purchase annual · purchase monthly · redeem offer code · restore on second device · expiry → gate returns gracefully (notes and Guide remain readable — **lapse never locks a person out of their own words**; it only closes new encounters).

## 4. Submission & launch sequence

1. Paid Agreement + banking clear (§1) → products created (§2) → slice lands (§3) → cut **build 14, v1.1.0** from `main`.
2. Submit with the subscription products attached (first-time subs are reviewed WITH the app version). Review notes: demo account + where the gate appears.
3. On approval: release, **then** the Substack announcement with the offer code. The community's first month is free; the practice is seven mornings free for everyone always.
4. Day-one watches: RevenueCat dashboard (purchases, code redemptions), the OpenAI usage dashboard, App Check metrics (enforce when green — the re-soak runs on 13's quiet traffic).

## 5. What this changes elsewhere

- **Build 15:** quiet release on approval. No announcement. Store page live = warm-up; its traffic re-soaks App Check.
- **The PMF plan's revenue test** updates: the founding-tier-on-Substack experiment is superseded by real App Store checkout + offer-code redemption rates — better data, same question: *who pays after seven mornings?* The §5 decision rule still stands: if the gate bounces warm users, price the reading, not the practice.
- **Pending from the launch list, unchanged:** server deploy + seeding + backfill (the Guide's magic), teaching doc-ID fixes, word-offerings engine — all should be LIVE before 14 announces, since paying users meet the Guide at full voice or not at all.
