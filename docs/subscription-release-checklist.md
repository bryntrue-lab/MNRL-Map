# Subscription release checklist

This branch contains the subscription screens, purchase service, encounter gate,
rules, and entitlement projection. It is not deployed or native-payment-verified.
Do not enable the paid gate or submit it until the release checks below pass.

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
- Use profile membership expiry for access; never use a client-reported payment
  result as permission to start an encounter.
- Server and rules enforcement for starting new encounters is implemented.
  Preserve reading access to notes and Guide. Do not enable restrictive rules
  under the old app.
- Deployment must precede activation: set EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
  in the subscription build, and set subscriptionConfig/runtime.enabled=true
  only for the coordinated release. Until activation the new gate remains off.
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

The SDK is loaded lazily so existing native development binaries do not attempt
to load an absent purchase module until the new feature is used.
