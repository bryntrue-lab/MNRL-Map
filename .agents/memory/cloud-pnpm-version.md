---
name: Cloud pnpm version
description: Keep cloud native installs on the verified workspace package-manager version.
---
Pin cloud native builds to the pnpm version verified locally rather than accepting the build image default.

**Why:** An unpinned Expo dashboard install failed with ERR_PNPM_IGNORED_BUILDS, including esbuild despite its existing allowlist entry. The same frozen install succeeds with pnpm 10.26.1. The uploaded log did not identify the cloud pnpm version.

**How to apply:** Upgrade the package manager deliberately and validate its dependency-script policy before changing the native build pin. A local install does not prove that a clean macOS native build will succeed.

Pin the native Xcode image as well while retaining SDK 54; avoid the moving `latest` alias.

**Why:** The newer cloud compiler produced fmt consteval errors matching https://github.com/fmtlib/fmt/issues/4740. Expo lists macos-sequoia-15.6-xcode-26.0 as its SDK 54 image. Pinning avoids a native dependency patch or an unauthorized SDK upgrade; cloud success still needs verification.

**How to apply:** Check Expo's current infrastructure documentation before selecting an image. Treat development and production build settings separately; do not silently change production tooling.