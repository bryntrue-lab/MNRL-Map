# Mineral static build configuration

Mineral uses checked-in static Expo configuration. There is no dynamic
`app.config.js` or `app.config.ts`. The release branch `main` selects the
production identity; `dev` uses the development identity for Mineral Dev.

- `app.production.json` is the approved production variant.
- `app.development.json` is the Mineral Dev variant:
  - display name: `Mineral Dev`
  - iOS bundle identifier: `com.madebymineral.quartz.dev`
  - scheme: `mineral-dev`
  - iOS Google services file: `./GoogleService-Info.dev.plist`
- All other configuration, including Android/native settings, stays the same.

Select a variant explicitly from the repository root:

```sh
pnpm --filter @workspace/mineral run config:development
pnpm --filter @workspace/mineral run config:production
```

The selector copies the chosen checked-in variant to `app.json`; it never uses
an environment variable or secret to choose a configuration. Run the
deterministic checks with:

```sh
pnpm --filter @workspace/mineral run test:config
```

## Connected GitHub development branch flow

1. Create or check out the dedicated development source branch that is
   connected to the dashboard.
2. From this repository, explicitly select the development variant:
   `pnpm --filter @workspace/mineral run config:development`.
3. Run `pnpm --filter @workspace/mineral run test:config`, then commit the
   resulting `artifacts/mineral/app.json` together with the checked-in variant
   and guard changes to that dedicated branch.
4. In the connected dashboard, select that branch, use the **development**
   build profile, and set the source directory to `artifacts/mineral`.
5. The pre-install guard compares `EAS_BUILD_PROFILE` with the active static
   app identity. A development build must use the development app identity;
   production and preview builds must use the production identity.

Do not select the development config on a production source branch. Do not use
the production Publish flow for the development branch. Production remains
protected by selecting `app.production.json` explicitly on its production
source branch.

## TestFlight releases

TestFlight is the current production distribution channel. Promote only an
approved candidate to `main`, select the production static variant, run the
configuration checks, and commit before publishing. Preserve the prior stable
build's exact source on a remote backup branch or immutable tag.

The production profile pins the same verified pnpm and Xcode image as the
development profile and uses remote build-number auto-increment. Record the
actual successful build number and source commit after upload; do not infer
the Apple build number from the static config.

GitHub's older uploaded patch-file commits are retained in main's merge
history. No force-push is needed for the release alignment.