---
name: Stable and development release branches
description: Approved Git release convention and preservation requirements.
---
Use main for the founder-approved stable Apple baseline, dev for ongoing development, and immutable release tags for the source commit recorded by each uploaded build.

**Why:** The founder wants a stable backup before testing a new candidate. Existing branch names did not reliably identify installed TestFlight source.

**How to apply:** Match the Apple build number to the build service's recorded commit, check for build-time uncommitted changes, and preserve old branch tips before alignment. The founder uses TestFlight as the current production workflow and explicitly approved promoting the selected development release to main; public App Store review is not a prerequisite. Do not promote later candidates without approval. Confirm remote pushes succeed; local tags are not off-workspace backups. Git references do not preserve deployed Firebase state or the signed binary.