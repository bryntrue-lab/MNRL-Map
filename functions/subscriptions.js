"use strict";

const { createHash, timingSafeEqual } = require("node:crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { membershipFromSubscriber, eventUserIds } = require("./subscriptionPolicy");

function authorized(actual, expected) {
  if (!expected || !actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function fetchSubscriber(uid, apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("RevenueCat server credential is not configured");
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000) }
  );
  // An error must never be interpreted as an expired subscription.
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  return response.json();
}

function createSubscriptionService({ db, apiKey, fetchImpl = fetch }) {
  async function sync(uid) {
    const userRef = db.doc(`users/${uid}`);
    const stateRef = db.doc(`subscriptionAccounts/${uid}`);
    const claim = await db.runTransaction(async tx => {
      const [user, state] = await Promise.all([tx.get(userRef), tx.get(stateRef)]);
      if (!user.exists || state.data()?.deleting) return null;
      const generation = (state.data()?.generation ?? 0) + 1;
      tx.set(stateRef, {
        generation, pending: true, requestedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { generation, allowSandbox: state.data()?.allowSandbox === true };
    });
    if (!claim) return { skipped: true };
    const body = await fetchSubscriber(uid, apiKey(), fetchImpl);
    const membership = membershipFromSubscriber(body, { allowSandbox: claim.allowSandbox });
    return db.runTransaction(async tx => {
      const [user, state] = await Promise.all([tx.get(userRef), tx.get(stateRef)]);
      if (!user.exists || state.data()?.deleting) return { skipped: true };
      // A slower, older refresh cannot overwrite a newer refresh.
      if (state.data()?.generation !== claim.generation) return { superseded: true };
      tx.update(userRef, {
        ...membership,
        membershipSince: membership.membershipSince === null ? user.data().membershipSince ?? null : Timestamp.fromMillis(membership.membershipSince),
        membershipExpiresAt: membership.membershipExpiresAt === null ? null : Timestamp.fromMillis(membership.membershipExpiresAt),
        membershipProductId: membership.membershipProductId ?? user.data().membershipProductId ?? null,
      });
      const nextSync = Math.min(
        Date.now() + 6 * 60 * 60 * 1000,
        membership.membershipExpiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
      );
      tx.set(stateRef, {
        pending: false, syncedAt: FieldValue.serverTimestamp(),
        nextSyncAt: Timestamp.fromMillis(nextSync),
      }, { merge: true });
      return { ...membership, skipped: false };
    });
  }
  return { sync };
}

function createSubscriptions({ db, apiKey, webhookSecret }) {
  const service = createSubscriptionService({ db, apiKey: () => apiKey.value() });
  const syncSubscription = onCall(
    { secrets: [apiKey], timeoutSeconds: 60, maxInstances: 10 },
    async request => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
      // Persistent per-user throttle also bounds API traffic from old clients.
      const ref = db.doc(`subscriptionSyncLimits/${uid}`);
      const allowed = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if ((snap.data()?.nextAt?.toMillis?.() ?? 0) > Date.now()) return false;
        tx.set(ref, { nextAt: Timestamp.fromMillis(Date.now() + 5000) });
        return true;
      });
      if (!allowed) throw new HttpsError("resource-exhausted", "Retry after five seconds");
      try {
        const result = await service.sync(uid);
        if (result.skipped) throw new HttpsError("failed-precondition", "Account unavailable");
        if (result.superseded) throw new HttpsError("aborted", "Refresh superseded; retry");
        return result;
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        // Do not expose provider details, credentials, or customer data.
        throw new HttpsError("unavailable", "Subscription verification unavailable");
      }
    }
  );

  const revenueCatWebhook = onRequest(
    { secrets: [apiKey, webhookSecret], timeoutSeconds: 300, maxInstances: 5 },
    async (req, res) => {
      if (req.method !== "POST") return res.status(405).end();
      if (!authorized(req.get("authorization"), `Bearer ${webhookSecret.value()}`)) {
        return res.status(401).end();
      }
      const event = req.body?.event;
      if (typeof event?.id !== "string" || !event.id || event.id.length > 512 ||
          typeof event.type !== "string") return res.status(400).end();
      if (event.type === "TEST") return res.status(200).json({ received: true });
      const hash = createHash("sha256").update(event.id).digest("hex");
      const eventRef = db.doc(`subscriptionEvents/${hash}`);
      if ((await eventRef.get()).exists) return res.status(200).json({ duplicate: true });
      const uids = eventUserIds(event);
      if (uids.length > 100) return res.status(400).end();
      try {
        for (const uid of uids) {
          const result = await service.sync(uid);
          if (result.superseded) throw new Error("Reconciliation superseded");
        }
        // Only mark complete AFTER all owners have been reconciled. Failed
        // deliveries return 503 so RevenueCat retries; no raw event is stored.
        await eventRef.set({ processedAt: FieldValue.serverTimestamp(), type: event.type });
        return res.status(200).json({ received: true });
      } catch {
        return res.status(503).json({ retry: true });
      }
    }
  );

  const reconcileSubscriptions = onSchedule(
    { schedule: "every 60 minutes", secrets: [apiKey], timeoutSeconds: 540, maxInstances: 1 },
    async () => {
      // Single-field queries need no composite index. Pending includes failures
      // after claiming a generation, even when a customer has never been active.
      const [pending, due] = await Promise.all([
        db.collection("subscriptionAccounts").where("pending", "==", true).limit(100).get(),
        db.collection("subscriptionAccounts").where("nextSyncAt", "<=", Timestamp.now())
          .orderBy("nextSyncAt").limit(100).get(),
      ]);
      let failures = 0;
      for (const uid of new Set([...pending.docs, ...due.docs].map(d => d.id))) {
        try { await service.sync(uid); } catch { failures++; }
      }
      if (failures) throw new Error(`Subscription reconciliation failed for ${failures} accounts`);
    }
  );
  return { syncSubscription, revenueCatWebhook, reconcileSubscriptions };
}

module.exports = { createSubscriptions, createSubscriptionService, authorized, fetchSubscriber };
