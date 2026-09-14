import assert from "node:assert/strict";
import {
  normalizeStoredReading,
  storedReadingNeedsQuoteValidation,
} from "./reading.ts";

const structured = {
  paragraphs: [
    {
      spans: [
        { text: "a phrase from the note", quote: true },
        { text: "guide prose", quote: false },
      ],
    },
  ],
  question: "what is being asked?",
};

function testCurrentStructuredDocument() {
  assert.deepEqual(normalizeStoredReading(structured), structured);
}

function testLegacyJsonTextIsParsedIntoFields() {
  const normalized = normalizeStoredReading({
    text: JSON.stringify(structured),
  }, ["a phrase from the note"]);
  assert.deepEqual(normalized, structured);
}

function testLegacyPlainTextAndMalformedJsonStayPlain() {
  const plain = "a reading that was stored before fields existed";
  assert.deepEqual(normalizeStoredReading({ text: plain }), {
    paragraphs: [{ spans: [{ text: plain, quote: false }] }],
    question: "",
  });

  const malformed = '{"paragraphs":[{"spans":[';
  assert.deepEqual(normalizeStoredReading({ text: malformed }), {
    paragraphs: [{ spans: [{ text: malformed, quote: false }] }],
    question: "",
  });
}

function testNestedMalformedSpanPayloadIsRecoveredAndValidated() {
  const nested =
    '{"paragraphs":[{"spans":[{"text":"the image is "quiet" and returns","quote":true}]}],"question":"what is "quiet" asking?"}';
  const legacy = {
    paragraphs: [{ spans: [{ text: nested }] }],
  };
  assert.equal(storedReadingNeedsQuoteValidation(legacy), true);
  const normalized = normalizeStoredReading(legacy, [
    'the image is "quiet" and returns',
  ]);

  assert.deepEqual(normalized, {
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

function testMultiSpanJsonLookingProseIsNotUnwrapped() {
  const nested = JSON.stringify({
    paragraphs: [{ spans: [{ text: "inner prose", quote: false }] }],
    question: "inner question?",
  });
  const outer = {
    paragraphs: [
      {
        spans: [
          { text: nested, quote: false },
          { text: "outer prose", quote: false },
        ],
      },
    ],
    question: "outer question?",
  };
  assert.deepEqual(normalizeStoredReading(outer), outer);
}

testCurrentStructuredDocument();
testLegacyJsonTextIsParsedIntoFields();
testLegacyPlainTextAndMalformedJsonStayPlain();
testNestedMalformedSpanPayloadIsRecoveredAndValidated();
testMultiSpanJsonLookingProseIsNotUnwrapped();
console.log("client reading normalizer tests passed");
