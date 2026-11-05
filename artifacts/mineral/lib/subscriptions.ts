import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import type { PurchasesPackage } from "react-native-purchases";
import { auth, functions } from "@/lib/firebase";

// Model B — `practice` is the one logical entitlement, returned by the
// server sync callable (which owns the RevenueCat provider-ID mapping).
// The controller trusts ONLY this bool; native SDK entitlements never grant.
export type SubscriptionAccess = {
  practice: boolean;
  membershipStatus: "free" | "member";
  membershipSince: number | null;
  membershipExpiresAt: number | null;
  membershipProductId: string | null;
};
export type SubscriptionPlans = {
  annual: PurchasesPackage;
  monthly: PurchasesPackage;
};

// Internal codes only: the UI must translate them using approved copy.
export class SubscriptionError extends Error {
  constructor(public readonly code: "unavailable" | "identity-changed" | "pending" | "invalid-offering") {
    super(code);
  }
}

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => {});
  return result;
}
function assertIdentity(uid: string) {
  if (auth.currentUser?.uid !== uid) throw new SubscriptionError("identity-changed");
}

// Lazy import: old native builds don't contain the new native module. Nothing
// loads it until a subscription action is invoked by the approved paywall.
async function purchasesFor(uid: string) {
  assertIdentity(uid);
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (Platform.OS !== "ios" || !apiKey?.startsWith("appl_")) {
    throw new SubscriptionError("unavailable");
  }
  const { default: Purchases } = await import("react-native-purchases");
  if (!(await Purchases.isConfigured())) Purchases.configure({ apiKey, appUserID: uid });
  else if ((await Purchases.getAppUserID()) !== uid) await Purchases.logIn(uid);
  assertIdentity(uid);
  return Purchases;
}

export function loadSubscriptionPlans(uid: string): Promise<SubscriptionPlans> {
  return serial(async () => {
    const Purchases = await purchasesFor(uid);
    const { current } = await Purchases.getOfferings();
    assertIdentity(uid);
    const annual = current?.annual;
    const monthly = current?.monthly;
    if (!annual || !monthly ||
        annual.product.identifier !== "MNRL108" || annual.product.subscriptionPeriod !== "P1Y" ||
        monthly.product.identifier !== "MNRL8" || monthly.product.subscriptionPeriod !== "P1M") {
      throw new SubscriptionError("invalid-offering");
    }
    // Always render product.priceString from these packages; no copied prices.
    // Lifetime/test packages are never returned to the UI.
    return { annual, monthly };
  });
}

async function refreshAccess(uid: string, waitForPurchase: boolean): Promise<SubscriptionAccess> {
  const call = httpsCallable<Record<string, never>, SubscriptionAccess>(functions, "syncSubscription");
  const attempts = waitForPurchase ? 4 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    assertIdentity(uid);
    try {
      const { data } = await call({});
      assertIdentity(uid);
      if (!waitForPurchase || data.practice === true) return data;
    } catch (error) {
      if (error instanceof SubscriptionError) throw error;
      // Closing Apple's sheet also triggers foreground sync. Both callers
      // are serialized, but can still collide with the server's 5s throttle.
      // Retry transient contention only; never infer access from the SDK.
      const code = (error as { code?: string })?.code;
      const contention = code === "functions/resource-exhausted" || code === "functions/aborted";
      if (!waitForPurchase && (!contention || attempt === attempts - 1)) throw error;
    }
    if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 5500));
  }
  // A completed payment is never labelled a failed purchase merely because
  // entitlement projection is delayed. Restore/refresh can retry safely.
  throw new SubscriptionError("pending");
}

export function refreshSubscriptionAccess(uid: string): Promise<SubscriptionAccess> {
  return serial(async () => {
    await purchasesFor(uid);
    return refreshAccess(uid, false);
  });
}

export function purchaseSubscription(uid: string, selected: PurchasesPackage): Promise<SubscriptionAccess> {
  return serial(async () => {
    if (!["MNRL108", "MNRL8"].includes(selected.product.identifier)) {
      throw new SubscriptionError("invalid-offering");
    }
    const Purchases = await purchasesFor(uid);
    try { await Purchases.purchasePackage(selected); }
    catch (error) {
      // StoreKit deferred/Ask to Buy is pending, not a failed payment.
      if ((error as { code?: string }).code === "20") throw new SubscriptionError("pending");
      throw error;
    }
    assertIdentity(uid);
    return refreshAccess(uid, true);
  });
}

export function restoreSubscription(uid: string): Promise<SubscriptionAccess> {
  return serial(async () => {
    const Purchases = await purchasesFor(uid);
    const restored = await Purchases.restorePurchases();
    assertIdentity(uid);
    // The SDK result is only a hint for how long to wait on server
    // projection — it never grants. Access comes from the server bool.
    const projectionLikely = Object.keys(restored.entitlements.active).length > 0;
    return refreshAccess(uid, projectionLikely);
  });
}

export function manageSubscription(uid: string): Promise<void> {
  return serial(async () => {
    const Purchases = await purchasesFor(uid);
    await Purchases.showManageSubscriptions();
    assertIdentity(uid);
    await refreshAccess(uid, false);
  });
}

export function redeemSubscriptionCode(uid: string): Promise<SubscriptionAccess> {
  return serial(async () => {
    const Purchases = await purchasesFor(uid);
    await Purchases.presentCodeRedemptionSheet();
    // Native dismissal does not signal a completed redemption; ask the server
    // (and refresh again on foreground) rather than announcing success.
    assertIdentity(uid);
    return refreshAccess(uid, false);
  });
}

export function clearSubscriptionIdentity(): Promise<void> {
  return serial(async () => {
    if (Platform.OS !== "ios" || !process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY) return;
    const { default: Purchases } = await import("react-native-purchases");
    if (await Purchases.isConfigured() && !(await Purchases.isAnonymous())) await Purchases.logOut();
  });
}
