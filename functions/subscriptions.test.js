"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ENTITLEMENT, membershipFromSubscriber, canStartEncounter, canOpenEncounter, eventUserIds } = require("./subscriptionPolicy");
const { authorized, fetchSubscriber, createSubscriptionService } = require("./subscriptions");
const now = Date.parse("2026-10-25T12:00:00Z");
function customer({ expiry = now + 10000, sandbox = false, product = "MNRL108", subscription = {}, entitlement = {} } = {}) {
  return { subscriber: {
    entitlements: { [ENTITLEMENT]: { product_identifier: product, expires_date: new Date(expiry).toISOString(), purchase_date: new Date(now - 10000).toISOString(), ...entitlement } },
    subscriptions: { [product]: { store: "app_store", is_sandbox: sandbox, ...subscription } },
  } };
}
test("annual and monthly Apple products grant access", () => {
  for (const product of ["MNRL108", "MNRL8"]) {
    assert.equal(membershipFromSubscriber(customer({ product }), { now }).membershipStatus, "member");
  }
});
test("cancelling renewal does not revoke paid time", () => {
  assert.equal(membershipFromSubscriber(customer({ subscription: { unsubscribe_detected_at: new Date(now).toISOString() } }), { now }).membershipStatus, "member");
});
test("expiry, refund, lifetime, wrong store and invalid dates fail closed", () => {
  for (const body of [
    customer({ expiry: now }), customer({ subscription: { refunded_at: new Date(now).toISOString() } }),
    customer({ product: "lifetime" }), customer({ subscription: { store: "promotional" } }),
    customer({ entitlement: { expires_date: null } }), customer({ entitlement: { expires_date: "broken" } }),
    { subscriber: {} },
  ]) assert.equal(membershipFromSubscriber(body, { now }).membershipStatus, "free");
});
test("active billing grace extends access but billing retry alone does not", () => {
  assert.equal(membershipFromSubscriber(customer({ expiry: now - 1, subscription: { grace_period_expires_date: new Date(now + 5000).toISOString() } }), { now }).membershipStatus, "member");
  assert.equal(membershipFromSubscriber(customer({ expiry: now - 1, subscription: { billing_issues_detected_at: new Date(now).toISOString() } }), { now }).membershipStatus, "free");
});
test("sandbox is denied except for server-allowlisted accounts", () => {
  assert.equal(membershipFromSubscriber(customer({ sandbox: true }), { now }).membershipStatus, "free");
  assert.equal(membershipFromSubscriber(customer({ sandbox: true }), { now, allowSandbox: true }).membershipStatus, "member");
});
test("malformed upstream response is an error, not a revocation", () => {
  assert.throws(() => membershipFromSubscriber({}, { now }));
});
test("gate begins at eight, and paid expiry is checked", () => {
  assert.equal(canStartEncounter({ sequenceDay: 7, completedEncounterCount: 6 }, now), true);
  assert.equal(canStartEncounter({ sequenceDay: 8, completedEncounterCount: 6 }, now), false);
  assert.equal(canStartEncounter({ sequenceDay: 1, completedEncounterCount: 7 }, now), false);
  assert.equal(canStartEncounter({ sequenceDay: 8, membershipStatus: "member", membershipExpiresAt: now + 1 }, now), true);
  assert.equal(canStartEncounter({ sequenceDay: 8, membershipStatus: "member", membershipExpiresAt: now }, now), false);
});
test("free users cannot bypass the gate by visiting future encounters", () => {
  const free = {sequenceDay:1,completedEncounterCount:0};
  assert.equal(canOpenEncounter(free,{phase:"signal",order:7},1,null,now),true);
  assert.equal(canOpenEncounter(free,{phase:"signal",order:8},1,null,now),false);
  assert.equal(canOpenEncounter(free,{phase:"field",order:1},1,null,now),false);
  assert.equal(canOpenEncounter(free,{phase:"signal",order:1},2,null,now),false);
  assert.equal(canOpenEncounter({...free,sequenceDay:8},{phase:"signal",order:1},1,null,now),false);
});
test("lapse leaves completed encounters and genuine in-progress sessions open", () => {
  const expired={sequenceDay:9,completedEncounterCount:8,membershipStatus:"member",membershipExpiresAt:now-1};
  for(const status of ["completed","in-progress"])
    assert.equal(canOpenEncounter(expired,{phase:"signal",order:8},1,{status},now),true);
  for(const status of ["saved","visited"])
    assert.equal(canOpenEncounter(expired,{phase:"signal",order:9},1,{status},now),false);
});
test("transfer reconciliation includes both owners and ignores unsafe IDs", () => {
  assert.deepEqual(eventUserIds({app_user_id:"new",aliases:["new","old","bad/path","$RCAnonymousID:123"],transferred_from:["old"],transferred_to:["new"]}), ["new", "old"]);
});
test("webhook authentication requires an exact secret", () => {
  assert.equal(authorized("Bearer test", "Bearer test"), true);
  assert.equal(authorized("Bearer wrong", "Bearer test"), false);
  assert.equal(authorized(undefined, "Bearer test"), false);
});
test("provider errors never become an empty subscription", async () => {
  await assert.rejects(fetchSubscriber("uid", "test", async () => ({ok:false,status:429})));
  await assert.rejects(fetchSubscriber("uid", ""));
  assert.deepEqual(await fetchSubscriber("uid", "test", async () => ({ok:true,json:async()=>({subscriber:{}})})), {subscriber:{}});
});

function fakeDb() {
  const docs = new Map([["users/test", { sequenceDay: 8 }]]);
  const snapshot = path => ({ exists: docs.has(path), data: () => docs.get(path) });
  return {
    docs,
    doc: path => ({ path }),
    runTransaction: async run => {
      const writes = [];
      const result = await run({
        get: async ref => snapshot(ref.path),
        set: (ref, data, options) => writes.push(() => docs.set(ref.path, options?.merge ? { ...docs.get(ref.path), ...data } : data)),
        update: (ref, data) => writes.push(() => {
          assert.ok(docs.has(ref.path));
          docs.set(ref.path, { ...docs.get(ref.path), ...data });
        }),
      });
      writes.forEach(write => write());
      return result;
    },
  };
}
test("sync projects verified access and preserves other profile fields", async () => {
  const db = fakeDb();
  const service = createSubscriptionService({ db, apiKey: () => "test",
    fetchImpl: async () => ({ok:true,json:async()=>customer({ expiry:Date.now()+60000 })}) });
  const result = await service.sync("test");
  assert.equal(result.membershipStatus, "member");
  assert.equal(db.docs.get("users/test").sequenceDay, 8);
  assert.equal(db.docs.get("subscriptionAccounts/test").pending, false);
});
test("missing or deleting accounts never trigger a purchase lookup or recreate profiles", async () => {
  const db = fakeDb();
  const service = createSubscriptionService({ db, apiKey: () => "test",
    fetchImpl: async () => { throw new Error("must not fetch"); } });
  assert.deepEqual(await service.sync("missing"), {skipped:true});
  db.docs.set("subscriptionAccounts/test", {deleting:true});
  assert.deepEqual(await service.sync("test"), {skipped:true});
});
test("deletion during a provider lookup fences the commit", async () => {
  const db = fakeDb();
  const service = createSubscriptionService({ db, apiKey: () => "test",
    fetchImpl: async () => {
      db.docs.set("subscriptionAccounts/test", {deleting:true});
      db.docs.delete("users/test");
      return {ok:true,json:async()=>customer({expiry:Date.now()+60000})};
    } });
  assert.deepEqual(await service.sync("test"), {skipped:true});
  assert.equal(db.docs.has("users/test"), false);
});
test("older lookup cannot overwrite a newer generation", async () => {
  const db = fakeDb();
  const service = createSubscriptionService({ db, apiKey: () => "test",
    fetchImpl: async () => {
      db.docs.set("subscriptionAccounts/test", {generation:2,pending:true});
      return {ok:true,json:async()=>customer({expiry:Date.now()+60000})};
    } });
  assert.deepEqual(await service.sync("test"), {superseded:true});
  assert.equal(db.docs.get("users/test").membershipStatus, undefined);
});
test("upstream failure preserves last membership and leaves reconciliation pending", async () => {
  const db = fakeDb();
  db.docs.set("users/test", {membershipStatus:"member",membershipProductId:"MNRL108"});
  const service = createSubscriptionService({ db, apiKey: () => "test",
    fetchImpl: async () => ({ok:false,status:503}) });
  await assert.rejects(service.sync("test"));
  assert.equal(db.docs.get("users/test").membershipStatus, "member");
  assert.equal(db.docs.get("subscriptionAccounts/test").pending, true);
});
