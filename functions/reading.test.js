"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  normalizeReading,
  parseReadingOutput,
  requestStructuredReading,
} = require("./reading");

const notes = ["this morning I found a blue door and stayed with it"];

// Execute the production callable with isolated Firebase/model boundaries.
// No Admin SDK initialization, accounts, live reads, writes, or API calls.
function readingCallableFixture({ noteCount = 2, enabled = true, exists = true } = {}) {
  const calls = [];
  const writes = [];
  const noteDocs = Array.from({ length: noteCount }, (_, index) => ({
    data: () => ({ content: `synthetic field note ${index}`, type: "spark" }),
  }));
  const notesRef = {
    orderBy: (_field, direction) => ({
      limit: (size) => ({
        get: async () => {
          calls.push("notes");
          const docs = direction === "asc" ? noteDocs.slice(0, size) : noteDocs.slice(-size);
          return { size: docs.length, docs };
        },
      }),
    }),
    count: () => ({
      get: async () => ({ data: () => ({ count: noteCount }) }),
    }),
  };
  const leaseRef = {};
  const latestQuery = {};
  const readingsRef = {
    doc: () => leaseRef,
    orderBy: () => ({ limit: () => latestQuery }),
    add: async (reading) => {
      writes.push(reading);
      return { id: "synthetic-reading" };
    },
  };
  const userRef = {
    get: async () => {
      calls.push("user");
      return { exists, data: () => ({ readingsEnabled: enabled }) };
    },
    collection: (name) => {
      calls.push(name);
      if (name === "fieldNotes") return notesRef;
      if (name === "readings") return readingsRef;
      assert.equal(name, "patterns");
      return { doc: () => ({ get: async () => ({ data: () => ({}) }) }) };
    },
  };
  const db = {
    doc: (docPath) => {
      if (docPath === "users/test-uid") return userRef;
      assert.equal(docPath, "practitionerContent/reading_prompt");
      return { get: async () => ({ exists: false }) };
    },
    runTransaction: async (work) => work({
      get: async (ref) => {
        if (ref === leaseRef) return { data: () => undefined };
        assert.equal(ref, latestQuery);
        return { docs: [] };
      },
      set: () => calls.push("lease"),
    }),
  };
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  const start = source.indexOf("exports.requestReading = onCall(");
  const end = source.indexOf("exports.countCompletion =", start);
  assert.ok(start >= 0 && end > start);
  const sandbox = {
    exports: {},
    onCall: (_options, handler) => handler,
    HttpsError,
    getFirestore: () => db,
    FieldValue: { serverTimestamp: () => "server-time" },
    openAiApiKey: { value: () => "synthetic-key" },
    READING_REST_MS: 20 * 60 * 60 * 1000,
    READING_LEASE_MS: 3 * 60 * 1000,
    DEFAULT_READING_PROMPT: "synthetic prompt",
    readingUserMessage: (fieldNotes, _patterns, count) => {
      assert.equal(fieldNotes.length, noteCount);
      assert.equal(count, noteCount);
      return "synthetic field";
    },
    requestStructuredReading: async ({ noteTexts }) => {
      calls.push("generate");
      assert.equal(noteTexts.length, noteCount);
      return {
        paragraphs: [{ spans: [{ text: "synthetic reading", quote: false }] }],
        question: "",
      };
    },
    releaseReadingLease: async () => calls.push("release"),
    waitForConcurrentReading: async () => { throw new Error("unexpected concurrent reading"); },
    fetch: () => { throw new Error("unexpected network call"); },
    console: { error() {} },
  };
  vm.runInNewContext(source.slice(start, end), sandbox);
  return { handler: sandbox.exports.requestReading, calls, writes };
}

async function testReflectionEligibilityAndPrivacy() {
  for (const noteCount of [0, 1]) {
    const fixture = readingCallableFixture({ noteCount });
    await assert.rejects(
      () => fixture.handler({ auth: { uid: "test-uid" } }),
      (error) => error.code === "failed-precondition" && error.message === "the field needs two notes."
    );
    assert.equal(fixture.calls.includes("generate"), false);
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.calls.at(-1), "release");
  }
  for (const noteCount of [2, 6, 7]) {
    const fixture = readingCallableFixture({ noteCount });
    const result = await fixture.handler({ auth: { uid: "test-uid" } });
    assert.equal(result.id, "synthetic-reading");
    assert.equal(fixture.calls.filter((call) => call === "generate").length, 1);
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.writes[0].noteCount, noteCount);
    assert.equal(fixture.calls.at(-1), "release");
  }
  for (const options of [{ enabled: false }, { enabled: null }, { exists: false }]) {
    const fixture = readingCallableFixture(options);
    await assert.rejects(
      () => fixture.handler({ auth: { uid: "test-uid" } }),
      (error) => error.code === "permission-denied"
    );
    assert.deepEqual(fixture.calls, ["user"]);
    assert.equal(fixture.writes.length, 0);
  }
  const fixture = readingCallableFixture();
  await assert.rejects(() => fixture.handler({}), (error) => error.code === "unauthenticated");
  assert.deepEqual(fixture.calls, []);
}

async function testMalformedOutputRetriesOnceAndFallsBackToText() {
  const responses = [
    "{not valid json",
    "the field keeps returning to the same door",
  ];
  let calls = 0;
  const telemetryEvents = [];
  const reading = await requestStructuredReading({
    apiKey: "test-key",
    systemPrompt: "system",
    userMessage: "notes",
    noteTexts: notes,
    telemetry: {
      info: (event, fields) => telemetryEvents.push({ event, fields }),
      warn: (event, fields) => telemetryEvents.push({ event, fields }),
    },
    fetchImpl: async (_url, init) => {
      calls += 1;
      const request = JSON.parse(init.body);
      assert.equal(request.response_format.type, "json_schema");
      assert.equal(request.response_format.json_schema.strict, true);
      assert.deepEqual(
        request.response_format.json_schema.schema.required,
        ["paragraphs", "question"]
      );
      assert.equal(request.messages[0].content, "system");
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: responses[calls - 1] } }],
        }),
      };
    },
  });

  assert.equal(calls, 2);
  assert.deepEqual(reading, {
    paragraphs: [{ spans: [{ text: responses[1], quote: false }] }],
    question: "",
  });
  assert.deepEqual(
    telemetryEvents.map(({ fields }) => fields.outcome),
    ["retry", "fallback"]
  );
  assert.equal(JSON.stringify(telemetryEvents).includes(responses[0]), false);
  assert.equal(JSON.stringify(telemetryEvents).includes(responses[1]), false);
}

async function testMalformedShapeRetriesOnceAndUsesSafeFallback() {
  const responses = [
    JSON.stringify({
      paragraphs: [{ spans: [{ text: "partial", quote: false }] }],
    }),
    JSON.stringify({
      paragraphs: [{ spans: [{ text: "still partial" }] }],
      question: "not persisted as structured",
    }),
  ];
  let calls = 0;
  const reading = await requestStructuredReading({
    apiKey: "test-key",
    systemPrompt: "system",
    userMessage: "notes",
    noteTexts: notes,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: responses[calls++] } }],
      }),
    }),
  });

  assert.equal(calls, 2);
  assert.deepEqual(reading, {
    paragraphs: [
      { spans: [{ text: "the reading did not arrive.", quote: false }] },
    ],
    question: "",
  });
}

function testValidFieldsArraysAndQuoteValidation() {
  const raw = JSON.stringify({
    paragraphs: [
      {
        spans: [
          { text: "this morning I found a blue door", quote: true },
          { text: "stayed with it", quote: true },
          { text: "this is an invented quote", quote: true },
          { text: "plain guide prose", quote: false },
        ],
      },
      { spans: [{ text: "what keeps opening?", quote: false }] },
    ],
    question: "what is the field asking?",
  });

  assert.deepEqual(normalizeReading(raw, notes), {
    paragraphs: [
      {
        spans: [
          { text: "this morning I found a blue door", quote: true },
          { text: "stayed with it", quote: true },
          { text: "this is an invented quote", quote: false },
          { text: "plain guide prose", quote: false },
        ],
      },
      { spans: [{ text: "what keeps opening?", quote: false }] },
    ],
    question: "what is the field asking?",
  });
}

function testMalformedShapeIsNotAcceptedAsStructuredReading() {
  assert.equal(
    parseReadingOutput('{"question":"only a question"}', notes),
    null
  );
}

function testMalformedNestedSpanPayloadIsRecoveredWithoutInventingText() {
  const raw =
    '{"paragraphs":[{"spans":[{"text":"the image is "quiet" and returns","quote":true}]}],"question":"what is "quiet" asking?"}';
  const reading = normalizeReading(raw, [
    'the image is "quiet" and returns',
  ]);

  assert.deepEqual(reading, {
    paragraphs: [
      {
        spans: [
          {
            text: 'the image is "quiet" and returns',
            quote: true,
          },
        ],
      },
    ],
    question: 'what is "quiet" asking?',
  });
}

function testLegacyEnvelopeWithMissingOuterQuestionIsUnwrapped() {
  const nested =
    '{"paragraphs":[{"spans":[{"text":"the image is "quiet" and returns","quote":true}]}],"question":"what is "quiet" asking?"}';
  const envelope = JSON.stringify({
    paragraphs: [{ spans: [{ text: nested }] }],
  });
  assert.deepEqual(normalizeReading(envelope, [
    'the image is "quiet" and returns',
  ]), {
    paragraphs: [
      {
        spans: [
          {
            text: 'the image is "quiet" and returns',
            quote: true,
          },
        ],
      },
    ],
    question: 'what is "quiet" asking?',
  });
}

function testSchemaValidationIsAtomic() {
  const malformed = JSON.stringify({
    paragraphs: [
      {
        spans: [
          { text: "keep this", quote: false },
          { text: "missing quote field" },
        ],
      },
    ],
    question: "what remains?",
  });
  assert.deepEqual(normalizeReading(malformed, notes), {
    paragraphs: [
      { spans: [{ text: "the reading did not arrive.", quote: false }] },
    ],
    question: "",
  });
}

function testObservedTrailingQuestionShapeIsRecoveredLosslessly() {
  const prose = Array.from({ length: 21 }, (_, index) => `span ${index + 1}`);
  const paragraphs = [11, 6, 4].map((count, paragraphIndex) => ({
    spans: prose
      .slice(
        [0, 11, 17][paragraphIndex],
        [0, 11, 17][paragraphIndex] + count
      )
      .map((text, spanIndex) => {
        const index = [0, 11, 17][paragraphIndex] + spanIndex;
        if (index >= 1 && index <= 6) return { text };
        return { text, quote: index === 0 || (index >= 7 && index <= 13) };
      }),
  }));
  const question = "what returns?";
  const inner = JSON.stringify({
    paragraphs: [...paragraphs, { question }],
  });
  const outer = JSON.stringify({
    paragraphs: [{ spans: [{ text: inner, quote: false }] }],
    question: "",
  });
  const quoted = [prose[0], prose[7], prose[9], prose[11]];
  const reading = normalizeReading(outer, quoted);

  assert.deepEqual(
    reading.paragraphs.flatMap((paragraph) =>
      paragraph.spans.map((span) => span.text)
    ),
    prose
  );
  assert.equal(reading.question, question);
  assert.equal(
    reading.paragraphs.flatMap((paragraph) => paragraph.spans)
      .filter((span) => span.quote).length,
    4
  );
  assert.equal(JSON.stringify(reading).includes(inner), false);
}

function testTruncatedLargeTailIsNeverPartiallyRecovered() {
  const completePrefix = JSON.stringify({
    paragraphs: [
      {
        spans: [
          { text: "first intact span", quote: false },
          { text: "second intact span", quote: false },
          { text: "third intact span", quote: false },
        ],
      },
    ],
    question: "what remains?",
  });
  const truncated = `${completePrefix}${"unfinished private tail ".repeat(3200)}`;

  assert.equal(parseReadingOutput(truncated, notes), null);
  assert.deepEqual(normalizeReading(truncated, notes), {
    paragraphs: [
      { spans: [{ text: "the reading did not arrive.", quote: false }] },
    ],
    question: "",
  });
}

function testMultiSpanJsonLookingProseIsNotUnwrapped() {
  const nested = JSON.stringify({
    paragraphs: [{ spans: [{ text: "inner prose", quote: false }] }],
    question: "inner question?",
  });
  const outer = JSON.stringify({
    paragraphs: [
      {
        spans: [
          { text: nested, quote: false },
          { text: "outer prose", quote: false },
        ],
      },
    ],
    question: "outer question?",
  });
  assert.deepEqual(normalizeReading(outer, notes), {
    paragraphs: [
      {
        spans: [
          { text: nested, quote: false },
          { text: "outer prose", quote: false },
        ],
      },
    ],
    question: "outer question?",
  });
}

async function testRecoverableWrappedJson() {
  const reading = await requestStructuredReading({
    apiKey: "test-key",
    systemPrompt: "system",
    userMessage: "notes",
    noteTexts: notes,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                'Here is the reading:\\n```json\\n{"paragraphs":[{"spans":[{"text":"blue door","quote":true}]}],"question":"what opens?"}\\n```',
            },
          },
        ],
      }),
    }),
  });

  assert.deepEqual(reading, {
    paragraphs: [{ spans: [{ text: "blue door", quote: true }] }],
    question: "what opens?",
  });
}

(async () => {
  await testReflectionEligibilityAndPrivacy();
  await testMalformedOutputRetriesOnceAndFallsBackToText();
  await testMalformedShapeRetriesOnceAndUsesSafeFallback();
  testValidFieldsArraysAndQuoteValidation();
  testMalformedShapeIsNotAcceptedAsStructuredReading();
  testMalformedNestedSpanPayloadIsRecoveredWithoutInventingText();
  testLegacyEnvelopeWithMissingOuterQuestionIsUnwrapped();
  testSchemaValidationIsAtomic();
  testObservedTrailingQuestionShapeIsRecoveredLosslessly();
  testTruncatedLargeTailIsNeverPartiallyRecovered();
  testMultiSpanJsonLookingProseIsNotUnwrapped();
  await testRecoverableWrappedJson();
  console.log("reading tests passed");
})();
