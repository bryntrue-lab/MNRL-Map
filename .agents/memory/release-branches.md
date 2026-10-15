---
name: Release branch discipline
description: Founder-approved feature-branch workflow and version-based release planning.
---
Use feature branches off main, not a standing dev branch. Production submissions come from main only. A long-lived feat/subscription branch must merge origin/main after other features merge; short-lived UI branches merge early and are then deleted. Branch-cut TestFlight builds are for internal sandbox testing only.

**Why:** The founder's October release ledger supersedes the earlier main/dev convention after branch divergence. App identity is selected by build profile, not branch.

**How to apply:** Check the current branch before commits and establish the intended feature branch. Retire dev only after confirming it has no unmerged work; do not delete it merely because it still exists. Plan and tag by semantic version; EAS build numbers are recorded after a build, never predicted. Preserve release references and verify remote backups before promotion. Git references do not preserve deployed Firebase state or signed binaries.

Keep rejection resubmissions hotfix-only. Do not make incompatible server/schema changes underneath a binary in review. A quiet initial App Store release precedes the subscription/public launch.

**Why:** The founder explicitly separates the submitted release from the revenue-enabling release to protect review scope.

**How to apply:** Subscription scope is RevenueCat, a gate-8 paywall, and offer codes. Obtain the referenced subscription plan before treating prices, entitlements, trials, or founder access as decided.