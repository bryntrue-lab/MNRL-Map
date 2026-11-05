# Subscription release checklist

This branch contains the subscription screens, purchase service, depth gates,
rules, and entitlement projection. The Firebase subscription backend and rules
are deployed; native payments are not yet verified.
Model B: daily practice is always free. Internal TestFlight testing precedes
public App Store review.

## Current testing build

Workspace changes after build 16: the supplied v3 paywall styling/plan picker
and bounded retries for subscription verification contention. These are not in
build 16; a new native build is required. Live sync logs showed successful calls
followed by HTTP 429 within a second during the reported restore period.
Client regression checks cover that collision without granting SDK-only access.
Personalized counts use real pattern data; return-day labels are omitted because
notes do not record the practice-day number at capture.

Mineral 1.1.0 build 16 finished successfully in EAS for internal subscription testing.
Build: https://expo.dev/accounts/bryntrue/projects/mineral/builds/fa7360f4-72ab-48dd-8416-466547a2e859
Upload to Apple App Store Connect succeeded on 2026-11-03. EAS reported the
binary is processing with Apple; TestFlight availability is not yet confirmed.
Submission: https://expo.dev/accounts/bryntrue/projects/mineral/submissions/83a0b8e2-ebbc-4ba9-b8bc-b64f14e114f5
TestFlight: https://appstoreconnect.apple.com/apps/6796385294/testflight/ios
The native sandbox matrix remains unverified. This upload did not submit the
version for public App Store review.
The founder-designated Mineral account is server-allowlisted for sandbox
verification. No membership, notes, or progress were changed; ordinary accounts
have not been granted sandbox access.

## Configuration

- US prices approved: $107.99/year and $12.99/month.
- Production Apple products: MNRL108 (P1Y) and MNRL8 (P1M).
- Reuse the existing RevenueCat entitlement and default offering. Apple products
  are attached alongside the Test Store products. Never display lifetime.
- EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is configured in the workspace and the
  EAS preview/production profiles using the existing Apple app public SDK key.
  It is not a private server key or Test Store key. The separate Mineral Dev
  bundle is not configured to sell the production app's Apple products.
- Firebase Secret Manager contains REVENUECAT_SERVER_API_KEY (validated against
  GET /v1/subscribers/{uid}) and a generated REVENUECAT_WEBHOOK_SECRET.
  Runtime secret access was configured by the Firebase deploy.
- RevenueCat's outgoing webhook is configured for the Apple app and both
  sandbox/production environments at the deployed function URL.
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
- Rules protecting practice and the sync, webhook, hourly reconciliation and
  deletion-fence functions are deployed. Reconcile existing subscribers to
  populate practice. Do NOT enable any obsolete encounter gate.
- Decide and implement purchase transfer/recovery behavior and RevenueCat
  customer-data retention/deletion policy. The deletion fence prevents profile
  resurrection; it is NOT cancellation or RevenueCat customer deletion.
- SDK identity clearing and foreground refresh are wired.
- EXPO_PUBLIC_PRIVACY_POLICY_URL is configured in the workspace and all EAS
  build profiles: https://madebymineral.com/mineral-quartz-privacy-policy
  The page is publicly accessible. Before release, update its processor list
  to cover RevenueCat and subscription-data handling; clarify account deletion
  does not cancel Apple subscriptions. Published policy has not been edited.
  Terms link uses Apple's standard EULA.
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

Live synthetic checks passed: authenticated webhook TEST returns 200, missing
webhook authentication returns 401, unpurchased sync remains free, client
practice grants are denied, free day-eight encounter writes remain allowed,
and account deletion removes the profile and nested encounter. Synthetic
Firebase and RevenueCat customers were cleaned up.
These checks do not substitute for an actual RevenueCat purchase notification
or native StoreKit transaction.

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
