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
  const reading = await requestStructuredReading({
    apiKey: "test-key",
    systemPrompt: "system",
    userMessage: "notes",
    noteTexts: notes,
    fetchImpl: async (_url, init) => {
      calls += 1;
      const request = JSON.parse(init.body);
      assert.deepEqual(request.response_format, { type: "json_object" });
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
}

async function testMalformedShapeRetriesOnceAndFallsBackToRawText() {
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
    paragraphs: [{ spans: [{ text: responses[1], quote: false }] }],
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
    paragraphs: [{ spans: [{ text: malformed, quote: false }] }],
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
  await testMalformedShapeRetriesOnceAndFallsBackToRawText();
  testValidFieldsArraysAndQuoteValidation();
  testMalformedShapeIsNotAcceptedAsStructuredReading();
  testMalformedNestedSpanPayloadIsRecoveredWithoutInventingText();
  testLegacyEnvelopeWithMissingOuterQuestionIsUnwrapped();
  testSchemaValidationIsAtomic();
  testMultiSpanJsonLookingProseIsNotUnwrapped();
  await testRecoverableWrappedJson();
  console.log("reading tests passed");
})();
