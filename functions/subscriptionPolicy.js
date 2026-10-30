"use strict";

// Use the existing RevenueCat entitlement, not a second competing entitlement.
const ENTITLEMENT = "mineral_a_creative_practice_pro";
const APPLE_PRODUCTS = new Set(["MNRL108", "MNRL8"]);
const FREE_ENCOUNTERS = 7;

function dateMillis(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// RevenueCat is authoritative. Webhook payloads never directly grant access.
function membershipFromSubscriber(body, { now = Date.now(), allowSandbox = false } = {}) {
  if (!body || !body.subscriber || typeof body.subscriber !== "object") {
    throw new Error("Invalid RevenueCat subscriber response");
  }
  const subscriber = body.subscriber;
  const entitlement = subscriber.entitlements?.[ENTITLEMENT];
  const free = { membershipStatus: "free", membershipSince: null,
    membershipExpiresAt: null, membershipProductId: null };
  if (!entitlement || !APPLE_PRODUCTS.has(entitlement.product_identifier)) return free;
  const subscription = subscriber.subscriptions?.[entitlement.product_identifier];
  if (!subscription || subscription.store !== "app_store") return free;
  // Unknown environments fail closed. TestFlight sandbox access is allowlisted
  // server-side per account and cannot unlock a normal production account.
  if (typeof subscription.is_sandbox !== "boolean" ||
      (subscription.is_sandbox && !allowSandbox)) return free;
  if (subscription.refunded_at) return free;
  const expiry = dateMillis(entitlement.expires_date);
  const grace = dateMillis(subscription.grace_period_expires_date);
  // No lifetime, malformed, or promotional entitlement can grant membership.
  if (expiry === null) return free;
  const effectiveExpiry = Math.max(expiry, grace ?? 0);
  if (effectiveExpiry <= now) return free;
  return {
    membershipStatus: "member",
    membershipSince: dateMillis(entitlement.purchase_date),
    membershipExpiresAt: effectiveExpiry,
    membershipProductId: entitlement.product_identifier,
  };
}

function canStartEncounter(profile, now = Date.now()) {
  if (!profile) return false;
  if ((profile.completedEncounterCount ?? 0) < FREE_ENCOUNTERS &&
      (profile.sequenceDay ?? 1) <= FREE_ENCOUNTERS) return true;
  const expiry = profile.membershipExpiresAt?.toMillis?.() ?? profile.membershipExpiresAt;
  return profile.membershipStatus === "member" &&
    typeof expiry === "number" && Number.isFinite(expiry) && expiry > now;
}

function canOpenEncounter(profile, encounter, turn, existing, now = Date.now()) {
  if (!profile || !encounter || !Number.isInteger(turn) || turn < 1) return false;
  if (existing && ["completed", "in-progress"].includes(existing.status)) return true;
  const expiry = profile.membershipExpiresAt?.toMillis?.() ?? profile.membershipExpiresAt;
  if (profile.membershipStatus === "member" && Number.isFinite(expiry) && expiry > now) return true;
  // Visiting a later encounter must not bypass the eighth-encounter gate.
  return canStartEncounter(profile, now) && turn === 1 &&
    encounter.phase === "signal" && Number.isInteger(encounter.order) &&
    encounter.order >= 1 && encounter.order <= FREE_ENCOUNTERS;
}

// Include old and new owners on transfers; reconcile everyone from the API.
function eventUserIds(event) {
  return [...new Set([
    event?.app_user_id, event?.original_app_user_id,
    ...(Array.isArray(event?.aliases) ? event.aliases : []),
    ...(Array.isArray(event?.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event?.transferred_to) ? event.transferred_to : []),
  ])].filter(uid => typeof uid === "string" && uid.length > 0 &&
    uid.length <= 128 && !uid.includes("/") && !uid.startsWith("$RCAnonymousID:"));
}

module.exports = { ENTITLEMENT, APPLE_PRODUCTS, membershipFromSubscriber, canStartEncounter, canOpenEncounter, eventUserIds };
