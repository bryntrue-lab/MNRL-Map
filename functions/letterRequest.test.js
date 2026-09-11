"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.NODE_ENV = "test";
const { __test } = require("./index");
const { letterRequests } = require("./founderDigest");

function timestamp(ms) {
  return { toMillis: () => ms };
}

const DAY = 86400000;
const NOW = 50 * DAY;

function letterDb({
  noteCount = 15,
  firstNoteAt = timestamp(NOW - 3 * DAY),
  existing,
} = {}) {
  const calls = [];
  const earliestDocs = firstNoteAt
    ? [{ data: () => ({ createdAt: firstNoteAt }) }]
    : [];
  const notesRef = {
    count: () => ({
      get: async () => {
        calls.push("fieldNotes.count");
        return { data: () => ({ count: noteCount }) };
      },
    }),
    select: (field) => {
      assert.equal(field, "createdAt");
      calls.push("fieldNotes.select(createdAt)");
      return {
        orderBy: (orderField) => {
          assert.equal(orderField, "createdAt");
          calls.push("fieldNotes.orderBy(createdAt)");
          return {
            limit: (size) => {
              assert.equal(size, 1);
              calls.push("fieldNotes.limit(1)");
              return {
                get: async () => {
                  calls.push("fieldNotes.earliest.get");
                  return { docs: earliestDocs };
                },
              };
            },
          };
        },
      };
    },
  };
  // Deliberately no patterns collection: eligibility must work with no
  // pattern documents and cannot regain a pattern-pipeline dependency.
  const userRef = {
    collection: (name) => {
      assert.equal(name, "fieldNotes");
      return notesRef;
    },
  };
  const requestRef = { path: "letterRequests/test-uid" };
  const writes = [];
  const db = {
    doc: (docPath) => {
      if (docPath === "users/test-uid") return userRef;
      assert.equal(docPath, "letterRequests/test-uid");
      return requestRef;
    },
    runTransaction: async (work) =>
      work({
        get: async (ref) => {
          assert.equal(ref, requestRef);
          return {
            exists: Boolean(existing),
            data: () => existing,
          };
        },
        create: (ref, data) => writes.push({ kind: "create", ref, data }),
        update: (ref, data) => writes.push({ kind: "update", ref, data }),
      }),
  };
  return { db, calls, writes };
}

async function rejects(handler, request, code) {
  await assert.rejects(
    () => handler(request),
    (error) => error?.code === code
  );
}

async function testGateAndPrivacy() {
  const belowGate = letterDb({ noteCount: 14 });
  const belowHandler = __test.createRequestLetterHandler({
    db: belowGate.db,
    serverTimestamp: () => "server-time",
  });
  await rejects(
    belowHandler,
    { auth: { uid: "test-uid", token: { email: "jane@example.test" } } },
    "failed-precondition"
  );
  assert.equal(belowGate.writes.length, 0);

  // Fifteen direct notes remain eligible even if no pattern document exists
  // or a rebuild has stalled. The fake exposes no patterns collection.
  const fixture = letterDb({ noteCount: 15 });
  const handler = __test.createRequestLetterHandler({
    db: fixture.db,
    serverTimestamp: () => "server-time",
    now: () => NOW,
  });
  const result = await handler({
    auth: { uid: "test-uid", token: { email: "jane@example.test" } },
    // A payload cannot influence the operation; the handler never reads it.
    data: { email: "forged@example.test", note: "private text" },
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fixture.calls, [
    "fieldNotes.count",
    "fieldNotes.select(createdAt)",
    "fieldNotes.orderBy(createdAt)",
    "fieldNotes.limit(1)",
    "fieldNotes.earliest.get",
  ]);
  assert.deepEqual(fixture.writes, [{
    kind: "create",
    ref: { path: "letterRequests/test-uid" },
    data: {
      email: "jane@example.test",
      noteCount: 15,
      dayCount: 4,
      createdAt: "server-time",
      status: "new",
    },
  }]);

  const noAuth = letterDb();
  await rejects(
    __test.createRequestLetterHandler({
      db: noAuth.db,
      serverTimestamp: () => "server-time",
    }),
    {},
    "unauthenticated"
  );
  assert.equal(noAuth.calls.length, 0);
  assert.equal(noAuth.writes.length, 0);

  const noEmail = letterDb();
  await rejects(
    __test.createRequestLetterHandler({
      db: noEmail.db,
      serverTimestamp: () => "server-time",
    }),
    { auth: { uid: "test-uid", token: {} } },
    "failed-precondition"
  );
  assert.equal(noEmail.calls.length, 0);
  assert.equal(noEmail.writes.length, 0);
}

async function testGuideDaySpanAndMissingTimestamp() {
  const sparse = letterDb({
    // Two actual note days spread across forty-one elapsed Guide days.
    firstNoteAt: timestamp(NOW - 40 * DAY),
  });
  const handler = __test.createRequestLetterHandler({
    db: sparse.db,
    serverTimestamp: () => "server-time",
    now: () => NOW,
  });
  await handler({
    auth: { uid: "test-uid", token: { email: "jane@example.test" } },
  });
  assert.equal(sparse.writes[0].data.dayCount, 41);

  const missing = letterDb({ firstNoteAt: null });
  await rejects(
    __test.createRequestLetterHandler({
      db: missing.db,
      serverTimestamp: () => "server-time",
      now: () => NOW,
    }),
    { auth: { uid: "test-uid", token: { email: "jane@example.test" } } },
    "failed-precondition"
  );
  assert.equal(missing.writes.length, 0);
}

async function testRerequestPreservesAnsweredRequest() {
  const fixture = letterDb({
    existing: {
      email: "jane@example.test",
      noteCount: 15,
      dayCount: 4,
      createdAt: timestamp(1),
      status: "answered",
    },
  });
  const handler = __test.createRequestLetterHandler({
    db: fixture.db,
    serverTimestamp: () => "later-server-time",
    now: () => NOW,
  });
  await handler({
    auth: { uid: "test-uid", token: { email: "jane@example.test" } },
  });
  assert.deepEqual(fixture.writes, [{
    kind: "update",
    ref: { path: "letterRequests/test-uid" },
    data: { lastAskedAt: "later-server-time" },
  }]);
}

async function testDigestOmitsAnsweredRequests() {
  const documents = [
    {
      data: () => ({
        email: "new@example.test",
        noteCount: 34,
        dayCount: 41,
        status: "new",
        createdAt: timestamp(2),
      }),
    },
    {
      data: () => ({
        email: "answered@example.test",
        noteCount: 20,
        dayCount: 20,
        status: "answered",
        createdAt: timestamp(1),
      }),
    },
  ];
  const db = {
    collection: (name) => {
      assert.equal(name, "letterRequests");
      return {
        where: (field, operator, value) => {
          assert.deepEqual([field, operator, value], ["status", "==", "new"]);
          return {
            get: async () => ({
              docs: documents.filter((doc) => doc.data().status === "new"),
            }),
          };
        },
      };
    },
  };
  assert.deepEqual(await letterRequests(db), [{
    email: "new@example.test",
    noteCount: 34,
    dayCount: 41,
  }]);
}

function testLetterRequestRulesAreServerOnly() {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  assert.match(
    rules,
    /match\s+\/letterRequests\/\{uid\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/s
  );
}

(async () => {
  await testGateAndPrivacy();
  await testGuideDaySpanAndMissingTimestamp();
  await testRerequestPreservesAnsweredRequest();
  await testDigestOmitsAnsweredRequests();
  testLetterRequestRulesAreServerOnly();
  console.log("letter request tests passed");
})();