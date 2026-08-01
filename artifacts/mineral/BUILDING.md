# Building & submitting Mineral (Task C §6)

App identity (already configured in `app.json`):
- iOS bundle identifier / Android package: `com.madebymineral.quartz`
- Version: `1.0.0` — build numbers auto-increment on production builds (`eas.json` → `autoIncrement`, `appVersionSource: "remote"`).
- Icons/splash: final assets wired from `assets/images/` (`icon-1024.png`, adaptive foreground/background, `splash-icon.png` on `#0A0610`, contain). Brand SVG kept at `assets/brand/mineral-icon.svg`.

## One-time setup (your machine, or any shell with the Expo account)
```bash
npm i -g eas-cli
eas login                      # your Expo account
eas init                       # links this app.json to an EAS project (writes extra.eas.projectId)
eas credentials                # let EAS manage iOS distribution cert + provisioning profile
```
Apple side (founder): the bundle ID `com.madebymineral.quartz` is registered; create the app record at appstoreconnect.apple.com if not already present.

## Builds
```bash
eas build --profile development --platform ios   # dev client for device testing
eas build --profile preview --platform ios       # internal distribution (TestFlight-less ad hoc)
eas build --profile production --platform ios    # App Store build (build number auto-increments)
```
Android equivalents: `--platform android`.

## Submit
```bash
eas submit --platform ios --latest               # uploads the latest production build to App Store Connect
```
`eas submit` will prompt for the App Store Connect app (or set `ascAppId` in `eas.json` → `submit.production.ios` once the record exists).

Notes:
- Voice reflections need a real device (simulators have no proper mic path); background narration audio (`UIBackgroundModes: audio`) is native-only — verify on device.
- The Firebase config ships via `EXPO_PUBLIC_FIREBASE_API_KEY` etc.; set the `EXPO_PUBLIC_*` values as EAS secrets (`eas secret:create`) before production builds.
- App Store privacy label (morning call ships with this build): **Location — coarse, app functionality only, not linked to identity, not used for tracking.** Location is requested only when the user picks "sunrise", stored locally on device, never sent anywhere.
