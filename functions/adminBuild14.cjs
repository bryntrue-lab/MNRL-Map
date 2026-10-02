#!/usr/bin/env node
"use strict";

// Explicitly authorized Build 14 administration. No seed/engine/scheduler imports,
// email writes, account creation, or credentials on disk. Default is read-only.
const admin = require("firebase-admin");
const assert = require("node:assert/strict");
const { isDeepStrictEqual } = require("node:util");

const PROJECT = "mineral-resonance";
const CHARGE_TEXT = "when the threshold closes, the day is already waiting. before it takes you — ask where its charge is. the heaviest thing in front of you, or the brightest. speak it into the field. i'll hold it against everything else you've said.";

function init() {
  assert(!process.env.FIRESTORE_EMULATOR_HOST, "live-emulator-refused");
  assert(!process.env.FIREBASE_AUTH_EMULATOR_HOST, "auth-emulator-refused");
  let account;
  try {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "");
  } catch {
    throw new Error("missing-or-invalid-service-account");
  }
  assert.equal(account.project_id, PROJECT, "project-mismatch");
  admin.initializeApp({
    credential: admin.credential.cert(account),
    projectId: PROJECT,
  });
  return admin.firestore();
}

function approvalPatch(data) {
  const patch = {};
  if (data.status === "draft") patch.status = "approved";
  if (Array.isArray(data.passages) && data.passages.some(p => p?.status === "draft")) {
    patch.passages = data.passages.map(p =>
      p?.status === "draft" ? { ...p, status: "approved" } : p
    );
  }
  return patch;
}

function counts(content, users) {
  const result = {
    contentDocuments: content.size,
    topLevelDrafts: 0,
    topLevelApproved: 0,
    passageDrafts: 0,
    passageApproved: 0,
    documentsWithDrafts: 0,
    userDocuments: users.size,
    readingsEnabled: 0,
    readingsNotEnabled: 0,
  };
  for (const doc of content.docs) {
    const data = doc.data();
    if (data.status === "draft") result.topLevelDrafts++;
    if (data.status === "approved") result.topLevelApproved++;
    for (const passage of data.passages || []) {
      if (passage?.status === "draft") result.passageDrafts++;
      if (passage?.status === "approved") result.passageApproved++;
    }
    if (Object.keys(approvalPatch(data)).length) result.documentsWithDrafts++;
  }
  for (const doc of users.docs) {
    if (doc.data().readingsEnabled === true) result.readingsEnabled++;
    else result.readingsNotEnabled++;
  }
  return result;
}

async function readInventory(db) {
  const [content, users, collections] = await Promise.all([
    db.collection("practitionerContent").get(),
    db.collection("users").select("readingsEnabled").get(),
    db.listCollections(),
  ]);
  // Auth identifiers stay in memory and are never logged or persisted.
  const authIds = new Set();
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) authIds.add(user.uid);
    pageToken = page.pageToken;
  } while (pageToken);
  const userIds = new Set(users.docs.map(doc => doc.id));
  const chargeCandidates = content.docs.filter(doc =>
    /charge/i.test(doc.id) || /^charge$/i.test(doc.data().key || "") ||
    doc.data().text === CHARGE_TEXT ||
    doc.data().passages?.some(p => p?.text === CHARGE_TEXT)
  ).map(doc => ({
    id: doc.id,
    kind: doc.data().kind || null,
    key: doc.data().key || null,
    keyType: doc.data().keyType || null,
    fields: Object.keys(doc.data()).sort(),
    exactTextMatches: (doc.data().passages || []).filter(p => p?.text === CHARGE_TEXT).length,
  }));
  return {
    content,
    users,
    summary: {
      project: PROJECT,
      database: "(default)",
      counts: counts(content, users),
      authAccounts: authIds.size,
      authAccountsWithoutUserDocument: [...authIds].filter(id => !userIds.has(id)).length,
      userDocumentsWithoutAuthAccount: [...userIds].filter(id => !authIds.has(id)).length,
      queueRelatedCollections: collections.map(ref => ref.id)
        .filter(id => /content|queue|passage/i.test(id)).sort(),
      chargeCandidates,
      specialContentDocuments: content.docs.filter(doc =>
        doc.data().kind !== "offering" && doc.data().kind !== "teaching"
      ).map(doc => ({ id: doc.id, kind: doc.data().kind || null, fields: Object.keys(doc.data()).sort() })),
    },
  };
}

async function approveDocument(db, ref) {
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) return { changed: false, deleted: true };
    const data = current.data();
    const patch = approvalPatch(data);
    if (!Object.keys(patch).length) return { changed: false };
    // Assert that only the two authorized status paths differ.
    const next = { ...data, ...patch };
    const restored = { ...next };
    if ("status" in patch) restored.status = data.status;
    if ("passages" in patch) {
      restored.passages = next.passages.map((p, i) =>
        data.passages[i]?.status === "draft" ? { ...p, status: "draft" } : p
      );
    }
    assert(isDeepStrictEqual(restored, data), "unauthorized-content-change");
    tx.update(ref, patch);
    return {
      changed: true,
      topLevel: data.status === "draft" ? 1 : 0,
      passages: (data.passages || []).filter(p => p?.status === "draft").length,
    };
  });
}

async function enableUser(db, ref) {
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) return { changed: false, deleted: true };
    if (current.data().readingsEnabled === true) return { changed: false };
    tx.update(ref, { readingsEnabled: true });
    return { changed: true };
  });
}

async function main() {
  const db = init();
  const before = await readInventory(db);
  console.log(JSON.stringify({ stage: "before", ...before.summary }, null, 2));
  if (!process.argv.includes("--apply-approved-and-readings")) return;
  const changed = { contentDocuments: 0, topLevelStatuses: 0, passageStatuses: 0, userDocuments: 0, deletedDuringRun: 0 };
  for (const doc of before.content.docs) {
    const result = await approveDocument(db, doc.ref);
    if (result.changed) {
      changed.contentDocuments++;
      changed.topLevelStatuses += result.topLevel;
      changed.passageStatuses += result.passages;
    }
    if (result.deleted) changed.deletedDuringRun++;
  }
  for (const doc of before.users.docs) {
    const result = await enableUser(db, doc.ref);
    if (result.changed) changed.userDocuments++;
    if (result.deleted) changed.deletedDuringRun++;
  }
  // Accounts/content can arrive while the live operation is in progress.
  // Reconcile fresh snapshots, without ever creating a missing user document.
  let after = await readInventory(db);
  let reconciliationPasses = 0;
  while (
    (after.summary.counts.topLevelDrafts ||
      after.summary.counts.passageDrafts ||
      after.summary.counts.readingsNotEnabled) &&
    reconciliationPasses < 5
  ) {
    reconciliationPasses++;
    for (const doc of after.content.docs) {
      if (!Object.keys(approvalPatch(doc.data())).length) continue;
      const result = await approveDocument(db, doc.ref);
      if (result.changed) {
        changed.contentDocuments++;
        changed.topLevelStatuses += result.topLevel;
        changed.passageStatuses += result.passages;
      }
      if (result.deleted) changed.deletedDuringRun++;
    }
    for (const doc of after.users.docs) {
      if (doc.data().readingsEnabled === true) continue;
      const result = await enableUser(db, doc.ref);
      if (result.changed) changed.userDocuments++;
      if (result.deleted) changed.deletedDuringRun++;
    }
    after = await readInventory(db);
  }
  console.log(JSON.stringify({ stage: "after", changed, reconciliationPasses, ...after.summary }, null, 2));
  assert.equal(after.summary.counts.topLevelDrafts, 0, "remaining-top-level-drafts");
  assert.equal(after.summary.counts.passageDrafts, 0, "remaining-passage-drafts");
  assert.equal(after.summary.counts.readingsNotEnabled, 0, "remaining-readings-disabled");
  console.log(JSON.stringify({
    verified: true,
    seed: "not-attempted-until-existing-charge-destination-is-established",
  }));
}

if (require.main === module) {
  main().catch(error => {
    // Do not emit SDK error messages/stacks, which can contain private paths.
    console.error(JSON.stringify({ failed: true, code: error.code || error.name }));
    process.exitCode = 1;
  });
}

module.exports = { approvalPatch, CHARGE_TEXT };