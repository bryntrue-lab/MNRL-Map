# Subscription release checklist

This branch contains the subscription screens, purchase service, depth gates,
rules, and entitlement projection. It is not deployed or native-payment-verified.
Model B: daily practice is always free. Do not submit until release checks pass.

## Configuration

- US prices approved: $107.99/year and $12.99/month.
- Production Apple products: MNRL108 (P1Y) and MNRL8 (P1M).
- Reuse the existing RevenueCat entitlement and default offering. Apple products
  are attached alongside the Test Store products. Never display lifetime.
- Supply EXPO_PUBLIC_REVENUECAT_IOS_API_KEY to both the development environment
  and the EAS build environment. This is the Apple public SDK key, not a secret
  server key and not the Test Store key.
- Firebase Secret Manager needs REVENUECAT_SERVER_API_KEY, a secret credential
  supporting GET /v1/subscribers/{uid}, and REVENUECAT_WEBHOOK_SECRET.
  Replit secrets alone do not provision Firebase secrets.
- Configure the outgoing RevenueCat webhook only after the function is deployed.
  Authorization must equal `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
  No private keys or token values belong in Git or this document.
- Apple server notifications point to RevenueCat; they are separate from the
  outgoing RevenueCat webhook.

## Still required before activation

- Founder-supplied paywall, all payment states, and account-deletion copy is
  implemented verbatim. Purchase/restore/management are wired into the screens.
- Use only server-written profile practice and verified expiry for depth access.
  No subscription checks belong in encounter flow, calendar gating or revisits.
- Gate full lens routes, passage sheets and Origin wander/date travel only.
  Preserve Notes and Guide essentials including hero inline offering.
- Day-eight invitation is shown once per user and Not Now continues practice.
  Depth entry re-presents the same invitation; prices come from store offerings.
- Deploy rules protecting practice from client mutation and the subscription
  sync functions before releasing. Reconcile existing subscribers to populate
  practice. Do NOT enable the obsolete subscriptionConfig/runtime encounter gate.
- Decide and implement purchase transfer/recovery behavior and RevenueCat
  customer-data retention/deletion policy. The deletion fence prevents profile
  resurrection; it is NOT cancellation or RevenueCat customer deletion.
- SDK identity clearing and foreground refresh are wired.
- Supply EXPO_PUBLIC_PRIVACY_POLICY_URL in workspace and EAS environments;
  no policy URL was supplied. Terms link uses Apple's standard EULA.
- Prepare a dedicated reviewer account with seven completed encounters and no
  completion today. Do not automatically reset progress during review.
- A sandbox tester's subscriptionAccounts/{uid}.allowSandbox is Admin-only.
  Production users must not obtain paid access from a sandbox receipt.
- Demonstrate annual purchase, monthly purchase, offer-code redemption,
  second-device restore, and lapse closing depth while practice continues.
- Test purchase, cancellation, restore, renewal, expiry, grace, refunds,
  transfers, delayed webhook/lookup responses and account deletion on a native
  build. Never claim native payment verification from a web preview or unit test.
- Verify first-purchase identities in webhook events and ensure failed refreshes
  recover. Set retention/TTL for subscriptionEvents and delete rate-limit state
  as part of the finalized account-deletion retention policy.
- Deploy the new functions and verify notifications; do not deploy all unrelated
  Firebase functions as a shortcut.
- Test in TestFlight before merging to main and submitting v1.1.0 with both
  subscriptions attached for Apple's first-subscription review.

## Checks available now

    cd functions && npm run test:subscriptions
    pnpm --filter @workspace/mineral typecheck
    pnpm --filter @workspace/mineral test:subscriptions
    pnpm --filter @workspace/mineral test:membership

Native sandbox acceptance matrix (not yet executed):
- Annual purchase → verified profile practice opens depth.
- Monthly purchase → same depth access.
- Offer-code redemption → server projection updates after StoreKit confirms.
- Second-device restore using the same Mineral account → depth opens there.
- Expiry/refund → open lens/passage closes and Origin returns to today;
  daily practice, all Notes, Guide essentials and revisits continue.
- Day-eight Not Now → encounter continues, including unavailable/pending store.

Some older frontend suites have baseline failures (build14Client, lensClient,
originCaption and fieldNotesState). Do not describe targeted subscription checks
as a passing whole-project suite.

The SDK is loaded lazily so existing native development binaries do not attempt
to load an absent purchase module until the new feature is used.
