"use strict";

const assert = require("node:assert/strict");
const {
  normalizeReading,
  parseReadingOutput,
  requestStructuredReading,
} = require("./reading");

const notes = ["this morning I found a blue door and stayed with it"];

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
