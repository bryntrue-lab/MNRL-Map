---
name: Cloud pnpm version
description: Keep cloud native installs on the verified workspace package-manager version.
---
Pin cloud native builds to the pnpm version verified locally rather than accepting the build image default.

**Why:** An unpinned Expo dashboard install failed with ERR_PNPM_IGNORED_BUILDS, including esbuild despite its existing allowlist entry. The same frozen install succeeds with pnpm 10.26.1. The uploaded log did not identify the cloud pnpm version.

**How to apply:** Upgrade the package manager deliberately and validate its dependency-script policy before changing the native build pin. A local install does not prove that a clean macOS native build will succeed.