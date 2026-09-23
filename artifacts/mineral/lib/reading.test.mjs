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

function testCanonicalFieldsWinOverStaleText() {
  assert.deepEqual(
    normalizeStoredReading({
      ...structured,
      text: "stale legacy prose",
    }),
    structured
  );
}

function testObservedValidNestedPayloadIsRecoveredWithMissingQuoteFlags() {
  const prose = Array.from({ length: 21 }, (_, index) => `prose ${index + 1}`);
  const starts = [0, 11, 17];
  const paragraphs = [11, 6, 4].map((count, paragraphIndex) => ({
    spans: prose
      .slice(starts[paragraphIndex], starts[paragraphIndex] + count)
      .map((text, spanIndex) => {
        const index = starts[paragraphIndex] + spanIndex;
        if (index >= 1 && index <= 6) return { text };
        return { text, quote: index === 0 || (index >= 7 && index <= 13) };
      }),
  }));
  const nested = JSON.stringify({
    paragraphs: [...paragraphs, { question: "what stays?" }],
  });
  const legacy = {
    paragraphs: [{ spans: [{ text: nested, quote: false }] }],
    question: "",
  };
  const trustedQuotes = [prose[0], prose[7], prose[9], prose[11]];
  const normalized = normalizeStoredReading(legacy, trustedQuotes);

  assert.deepEqual(
    normalized.paragraphs.flatMap((paragraph) =>
      paragraph.spans.map((span) => span.text)
    ),
    prose
  );
  assert.equal(normalized.question, "what stays?");
  for (const span of normalized.paragraphs.flatMap((paragraph) => paragraph.spans)) {
    if (span.quote) assert.ok(trustedQuotes.includes(span.text));
  }
  assert.equal(
    normalized.paragraphs.flatMap((paragraph) => paragraph.spans)
      .filter((span) => span.quote).length,
    4
  );
}

function testTruncatedLargeTailIsPreservedRatherThanPartiallyRecovered() {
  const prefix = JSON.stringify({
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
  const truncated = `${prefix}${"unfinished private tail ".repeat(3200)}`;

  assert.deepEqual(normalizeStoredReading({ text: truncated }), {
    paragraphs: [{ spans: [{ text: truncated, quote: false }] }],
    question: "",
  });
}

testCurrentStructuredDocument();
testLegacyJsonTextIsParsedIntoFields();
testLegacyPlainTextAndMalformedJsonStayPlain();
testNestedMalformedSpanPayloadIsRecoveredAndValidated();
testMultiSpanJsonLookingProseIsNotUnwrapped();
testCanonicalFieldsWinOverStaleText();
testObservedValidNestedPayloadIsRecoveredWithMissingQuoteFlags();
testTruncatedLargeTailIsPreservedRatherThanPartiallyRecovered();
console.log("client reading normalizer tests passed");
