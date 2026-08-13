// Slice AC — native App Check token source.
//
// The Firebase JS SDK stays the only data-layer SDK in the app. On native,
// @react-native-firebase/app-check is used purely as a token source: its
// native module performs App Attest (iOS, DeviceCheck fallback automatic) or
// Play Integrity (Android, rides along for free), and the resulting token is
// handed to the JS SDK through a CustomProvider (see lib/firebase.ts).
//
// Dev/simulator builds use the App Check DEBUG provider. On first run the
// native Firebase SDK prints the generated debug token to the device/Xcode
// console — register it in Firebase console → App Check → Apps → Manage
// debug tokens. Optionally pin one via EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN.
//
// Expo Go has no native Firebase module: the require() below throws, we log
// once and report unavailable — the caller then skips App Check entirely,
// exactly the pre-slice behavior. Dev clients keep working either way.

type RnfbAppCheck = {
  initialized: boolean;
  getToken: () => Promise<{ token: string }>;
};

let setupPromise: Promise<RnfbAppCheck | null> | null = null;

function setup(): Promise<RnfbAppCheck | null> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      // Lazy require: must not crash Expo Go at import time.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const rnfbAppCheckModule = require("@react-native-firebase/app-check");
      const appCheck = rnfbAppCheckModule.firebase.appCheck();

      const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
      const provider = appCheck.newReactNativeFirebaseAppCheckProvider();
      provider.configure({
        apple: __DEV__
          ? { provider: "debug", ...(debugToken ? { debugToken } : {}) }
          : { provider: "appAttestWithDeviceCheckFallback" },
        android: __DEV__
          ? { provider: "debug", ...(debugToken ? { debugToken } : {}) }
          : { provider: "playIntegrity" },
      });

      await appCheck.initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });

      if (__DEV__) {
        console.log(
          "[app-check] debug provider active — the native SDK logs the debug " +
            "token on first run; register it in Firebase console → App Check."
        );
      }

      return {
        initialized: true,
        getToken: async () => appCheck.getToken(false),
      };
    } catch (err) {
      // Expo Go / missing native module — App Check stays off, app works.
      console.log(
        "[app-check] native module unavailable; attestation skipped.",
        err instanceof Error ? err.message : err
      );
      return null;
    }
  })();
  return setupPromise;
}

/** JWT exp → ms; falls back to a conservative 30 minutes. */
function tokenExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(
      global.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number };
    if (payload.exp) return payload.exp * 1000;
  } catch {
    // fall through
  }
  return Date.now() + 30 * 60 * 1000;
}

/**
 * Token callback for the JS SDK's CustomProvider. Throwing is correct when
 * no token is available — the JS SDK treats it as "attestation failed" and,
 * while enforcement is off, requests proceed unattested (today's behavior).
 */
export async function getNativeAppCheckToken(): Promise<{
  token: string;
  expireTimeMillis: number;
}> {
  const rnfb = await setup();
  if (!rnfb) throw new Error("app-check native module unavailable");
  const { token } = await rnfb.getToken();
  return { token, expireTimeMillis: tokenExpiryMs(token) };
}
