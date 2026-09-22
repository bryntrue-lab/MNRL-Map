"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  SCHEDULE,
  TIME_ZONE,
  buildReport,
  createOutboxDocument,
  reportId,
  reportWindow,
  summarizeActivity,
  summarizeAuthUsers,
  summarizeEventCounts,
} = require("./weeklyUsageReport");

const end = Date.parse("2025-03-14T12:00:00.000Z");
const window = reportWindow(new Date(end).toISOString());
const at = (offset) => new Date(end + offset).toISOString();

const indexConfig = require(path.join(__dirname, "..", "firestore.indexes.json"));
for (const [collectionGroup, fieldPath] of [
  ["fieldNotes", "createdAt"],
  ["userEncounters", "startedAt"],
  ["userEncounters", "completedAt"],
  ["userEncounters", "visitedAt"],
]) {
  const override = indexConfig.fieldOverrides.find(
    (candidate) =>
      candidate.collectionGroup === collectionGroup &&
      candidate.fieldPath === fieldPath
  );
  assert.ok(override, `${collectionGroup}.${fieldPath} override is required`);
  assert.deepEqual(
    override.indexes
      .map(({ order, queryScope }) => `${queryScope}:${order}`)
      .sort(),
    [
      "COLLECTION:ASCENDING",
      "COLLECTION:DESCENDING",
      "COLLECTION_GROUP:ASCENDING",
    ],
    `${collectionGroup}.${fieldPath} must retain normal collection indexes`
  );
}

assert.equal(SCHEDULE, "0 7 * * 5");
assert.equal(TIME_ZONE, "America/Chicago");
assert.equal(window.start7Ms, end - 7 * 86400000);
assert.equal(window.start30Ms, end - 30 * 86400000);

const auth = summarizeAuthUsers([
  { metadata: { creationTime: at(-7 * 86400000) }, providerData: [] },
  {
    metadata: { creationTime: at(-30 * 86400000) },
    providerData: [{ providerId: "password", email: "private@example.test" }],
  },
  {
    metadata: { creationTime: at(-1) },
    providerData: [{ providerId: "google.com" }],
  },
  { metadata: { creationTime: at(0) }, providerData: [] },
], window);
assert.deepEqual(auth, {
  total: 4,
  anonymous: 2,
  password: 1,
  otherProvider: 1,
  new7: 2,
  new30: 3,
});

const activity = summarizeActivity([
  { uid: "private-a", at: at(-30 * 86400000) },
  { uid: "private-a", at: at(-7 * 86400000) },
  { uid: "private-a", at: at(-7 * 86400000 + 1000) },
  { uid: "private-a", at: at(-6 * 86400000) },
  { uid: "private-b", at: at(-1) },
  { uid: "private-b", at: at(-1) },
  { uid: "excluded-at-end", at: at(0) },
  { uid: "excluded-before", at: at(-30 * 86400000 - 1) },
], window);
assert.deepEqual(activity, {
  days7: {
    activeAccounts: 2,
    activeAccountDays: 3,
    returningAccounts: 1,
    averageDays: 1.5,
  },
  days30: {
    activeAccounts: 2,
    activeAccountDays: 4,
    returningAccounts: 1,
    averageDays: 2,
  },
});
assert.deepEqual(summarizeEventCounts([
  { at: at(-30 * 86400000) },
  { at: at(-7 * 86400000) },
  { at: at(-1) },
  { at: at(0) },
], window), { days7: 2, days30: 3 });

const message = buildReport({
  auth,
  firestore: {
    onboarded: 3,
    notesLifetime: 8,
    completionsLifetime: 5,
    activity,
    recent: {
      days7: { notes: 4, starts: 3, completions: 2 },
      days30: { notes: 14, starts: 13, completions: 12 },
    },
  },
  window,
});
assert.match(message.text, /Accounts are not people/);
assert.match(message.text, /Development and production data are shared/);
assert.match(message.text, /does not track session duration/);
assert.match(message.text, /UTC active account-days/);
assert.match(message.text, /2 active accounts · 1 returning on 2\+ UTC days/);
assert.match(message.text, /Events: 4 notes · 3 encounter starts · 2 encounter completions/);
assert.match(message.text, /Events: 14 notes · 13 encounter starts · 12 encounter completions/);
assert.match(message.text, /\[2025-03-07T12:00:00.000Z, 2025-03-14T12:00:00.000Z\)/);
assert.doesNotMatch(message.text, /private-a|private-b|private@example/);
assert.doesNotMatch(message.subject, /private-a|private-b|private@example/);
assert.equal(
  reportId(window),
  "weekly-usage-2025-03-14T12-00-00-000Z"
);

(async () => {
  const writes = [];
  const fakeDb = {
    doc(path) {
      return {
        async create(data) {
          if (writes.some((write) => write.path === path)) {
            const error = new Error("exists");
            error.code = 6;
            throw error;
          }
          writes.push({ path, data });
        },
      };
    },
  };
  assert.equal(await createOutboxDocument(fakeDb, reportId(window), "founder@example.test", message), true);
  assert.equal(await createOutboxDocument(fakeDb, reportId(window), "founder@example.test", message), false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, `mail/${reportId(window)}`);
  console.log("weeklyUsageReport tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});