"use strict";

const assert = require("node:assert/strict");

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
  notesRead = noteCount,
  firstNoteAt = timestamp(NOW - 3 * DAY),
  conditionsExists = true,
  existing,
} = {}) {
  const calls = [];
  const notesRef = {
    count: () => ({
      get: async () => {
        calls.push("fieldNotes.count");
        return { data: () => ({ count: noteCount }) };
      },
    }),
  };
  const conditionsRef = {
    get: async () => {
      calls.push("patterns.conditions.get");
      return {
        exists: conditionsExists,
        data: () => ({ notesRead, firstNoteAt }),
      };
    },
  };
  const userRef = {
    collection: (name) => {
      assert.equal(name, "fieldNotes");
      return notesRef;
    },
  };
  // The real callable asks for patterns once; model that nested reference
  // without adding a readable fieldNotes API to the fake.
  userRef.collection = (name) => {
    if (name === "fieldNotes") return notesRef;
    assert.equal(name, "patterns");
    return { doc: (id) => {
      assert.equal(id, "conditions");
      return conditionsRef;
    } };
  };
  const requestRef = { path: "letterRequests/test-uid" };
  const writes = [];
  const db = {
    doc: (path) => {
      if (path === "users/test-uid") return userRef;
      assert.equal(path, "letterRequests/test-uid");
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
  const belowGate = letterDb({ noteCount: 14, notesRead: 14 });
  const belowHandler = __test.createRequestLetterHandler({
    db: belowGate.db,
    serverTimestamp: () => "server-time",
  });
  await rejects(
    belowHandler,
    { auth: { uid: "test-uid", token: { email: "jane@example.test" } } },
    "failed-precondition"
  );

  const fixture = letterDb({ noteCount: 15, notesRead: 15 });
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
  assert.deepEqual(fixture.calls, ["fieldNotes.count", "patterns.conditions.get"]);
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
}

async function testGuideDaySpanAndMissingMetadata() {
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

  const staleCount = letterDb({ notesRead: 14 });
  await rejects(
    __test.createRequestLetterHandler({
      db: staleCount.db,
      serverTimestamp: () => "server-time",
      now: () => NOW,
    }),
    { auth: { uid: "test-uid", token: { email: "jane@example.test" } } },
    "failed-precondition"
  );
  assert.equal(staleCount.writes.length, 0);
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

(async () => {
  await testGateAndPrivacy();
  await testGuideDaySpanAndMissingMetadata();
  await testRerequestPreservesAnsweredRequest();
  await testDigestOmitsAnsweredRequests();
  console.log("letter request tests passed");
})();