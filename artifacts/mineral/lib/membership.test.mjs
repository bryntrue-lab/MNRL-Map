import test from "node:test";
import assert from "node:assert/strict";
import {
  practiceActive, msUntilLapse, shouldOfferThresholdInvitation,
  invitationSeenUpdate, invitationEvidence,
} from "./membership.ts";

const at = (ms) => ({ toMillis: () => ms });
const NOW = 1_800_000_000_000;

test("practice requires the server bool AND a future expiry", () => {
  assert.equal(practiceActive({ practice: true, membershipExpiresAt: at(NOW + 1) }, NOW), true);
  assert.equal(practiceActive({ practice: true, membershipExpiresAt: at(NOW - 1) }, NOW), false);
  assert.equal(practiceActive({ practice: true, membershipExpiresAt: null }, NOW), false);
  assert.equal(practiceActive({ practice: false, membershipExpiresAt: at(NOW + 1e9) }, NOW), false);
  // legacy status field alone never grants
  assert.equal(practiceActive({ membershipStatus: "member", membershipExpiresAt: at(NOW + 1e9) }, NOW), false);
  assert.equal(practiceActive(null, NOW), false);
});

test("live clock schedules lapse at expiry", () => {
  assert.equal(msUntilLapse({ practice: true, membershipExpiresAt: at(NOW + 1000) }, NOW), 1050);
  assert.equal(msUntilLapse({ practice: false }, NOW), null);
  assert.ok(msUntilLapse({ practice: true, membershipExpiresAt: at(NOW + 1e12) }, NOW) <= 2_147_000_000);
});

test("threshold invitation appears once at day eight, without checking entitlement, never for visits", () => {
  const base = { sequenceDay: 8, practice: false };
  assert.equal(shouldOfferThresholdInvitation({ profile: base, now: NOW, visiting: false }), true);
  assert.equal(shouldOfferThresholdInvitation({ profile: { ...base, sequenceDay: 7 }, now: NOW, visiting: false }), false);
  assert.equal(shouldOfferThresholdInvitation({ profile: { ...base, membershipInvitationSeen: true }, now: NOW, visiting: false }), false);
  assert.equal(shouldOfferThresholdInvitation({ profile: base, now: NOW, visiting: true }), false);
  assert.equal(shouldOfferThresholdInvitation({
    profile: { ...base, practice: true, membershipExpiresAt: at(NOW + 5) }, now: NOW, visiting: false,
  }), true);
});

test("seen flag is monotonic", () => {
  assert.deepEqual(invitationSeenUpdate({}), { membershipInvitationSeen: true });
  assert.equal(invitationSeenUpdate({ membershipInvitationSeen: true }), null);
});

test("evidence uses only real returning items and real note counts", () => {
  assert.equal(invitationEvidence({}, 9), null);
  assert.equal(invitationEvidence({ motif: { itemCounts: { salt: 1 } } }, 9), null);
  assert.deepEqual(
    invitationEvidence({ motif: { itemCounts: { salt: 2 } }, thread: { itemCounts: { threshold: 3 } } }, 9),
    { item: "threshold", count: 3, notes: 9 }
  );
  // inconsistent data (more returns than notes) is never shown
  assert.equal(invitationEvidence({ motif: { itemCounts: { x: 5 } } }, 2), null);
});
