export type ReadingSpan = {
  text: string;
  quote: boolean;
};

export type ReadingParagraph = {
  spans: ReadingSpan[];
};

export type NormalizedReading = {
  paragraphs: ReadingParagraph[];
  question: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function plainTextReading(text: string): NormalizedReading {
  return {
    paragraphs: [{ spans: [{ text, quote: false }] }],
    question: "",
  };
}

const JSON_STRING_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

function decodeJsonStringFragment(fragment: string): string {
  let text = "";
  for (let index = 0; index < fragment.length; index += 1) {
    if (fragment[index] !== "\\") {
      text += fragment[index];
      continue;
    }
    const escaped = fragment[index + 1];
    const unicode = fragment.slice(index + 2, index + 6);
    if (escaped === "u" && /^[0-9a-f]{4}$/i.test(unicode)) {
      text += String.fromCharCode(parseInt(unicode, 16));
      index += 5;
    } else if (escaped && Object.hasOwn(JSON_STRING_ESCAPES, escaped)) {
      text += JSON_STRING_ESCAPES[escaped];
      index += 1;
    } else {
      text += "\\";
    }
  }
  return text;
}

function fieldOpening(
  source: string,
  key: string,
  fromIndex: number
): { keyIndex: number; opening: number } | null {
  const keyIndex = source.indexOf(`"${key}"`, fromIndex);
  if (keyIndex < 0) return null;
  const colon = source.indexOf(":", keyIndex + key.length + 2);
  if (colon < 0) return null;
  let opening = colon + 1;
  while (/\s/.test(source[opening] ?? "")) opening += 1;
  return source[opening] === '"' ? { keyIndex, opening } : null;
}

type RecoveredReading = {
  paragraphs: ReadingParagraph[];
  question: string;
};

/**
 * Recover only the old malformed shape where an unescaped quote in a span
 * made the whole JSON string invalid. Structural markers and the following
 * quote boolean must be present; ambiguous candidates are rejected.
 */
function recoverMalformedReading(sourceText: string): {
  reading: RecoveredReading | null;
  ambiguous: boolean;
} {
  const source = sourceText.trim();
  const paragraphsKey = source.indexOf('"paragraphs"');
  if (paragraphsKey < 0) return { reading: null, ambiguous: false };
  const questionKey = source.indexOf('"question"', paragraphsKey);
  const bodyEnd = questionKey >= 0 ? questionKey : source.length;

  const spansKeys: number[] = [];
  const spansPattern = /"spans"\s*:\s*\[/g;
  spansPattern.lastIndex = paragraphsKey;
  for (
    let match = spansPattern.exec(source);
    match;
    match = spansPattern.exec(source)
  ) {
    if (match.index >= bodyEnd) break;
    spansKeys.push(match.index);
  }
  if (spansKeys.length === 0) return { reading: null, ambiguous: false };

  const textPattern = /"text"\s*:/g;
  textPattern.lastIndex = paragraphsKey;
  const recoveredSpans: ReadingSpan[][] = spansKeys.map(() => []);
  let textCount = 0;
  let finalQuoteValueEnd = -1;
  for (
    let match = textPattern.exec(source);
    match;
    match = textPattern.exec(source)
  ) {
    if (match.index >= bodyEnd) break;
    textCount += 1;
    const opening = fieldOpening(source, "text", match.index)?.opening;
    if (opening === undefined) return { reading: null, ambiguous: true };

    const quotePattern = /,\s*"quote"\s*:\s*(true|false)/g;
    quotePattern.lastIndex = opening + 1;
    const quoteMatch = quotePattern.exec(source);
    if (!quoteMatch) return { reading: null, ambiguous: true };

    let closing = quoteMatch.index - 1;
    while (/\s/.test(source[closing] ?? "")) closing -= 1;
    if (source[closing] !== '"') return { reading: null, ambiguous: true };

    const nextText = source.indexOf('"text"', opening + 1);
    const laterMarker = source.indexOf(
      '"quote"',
      quoteMatch.index + quoteMatch[0].length
    );
    if (laterMarker >= 0 && laterMarker < (nextText >= 0 ? nextText : bodyEnd)) {
      return { reading: null, ambiguous: true };
    }

    const paragraphIndex = spansKeys.reduce(
      (index, spansIndex, candidateIndex) =>
        spansIndex <= match.index ? candidateIndex : index,
      0
    );
    recoveredSpans[paragraphIndex].push({
      text: decodeJsonStringFragment(source.slice(opening + 1, closing)),
      quote: quoteMatch[1] === "true",
    });
    finalQuoteValueEnd = quoteMatch.index + quoteMatch[0].length;
  }
  if (
    textCount === 0 ||
    recoveredSpans.every((spans) => spans.length === 0)
  ) {
    return { reading: null, ambiguous: false };
  }
  // Do not heal a valid-looking prefix while discarding a truncated tail.
  // Past the final span, only the exact envelope's closing syntax may remain.
  if (
    finalQuoteValueEnd < 0 ||
    !/^[\s}\],]*$/.test(
      source.slice(
        finalQuoteValueEnd,
        questionKey >= 0 ? questionKey : source.length
      )
    )
  ) {
    return { reading: null, ambiguous: true };
  }

  let question = "";
  if (questionKey >= 0) {
    const questionField = fieldOpening(source, "question", questionKey);
    if (questionField) {
      let closing = source.length - 1;
      while (closing >= questionField.opening && source[closing] !== '"') {
        closing -= 1;
      }
      if (closing > questionField.opening) {
        question = decodeJsonStringFragment(
          source.slice(questionField.opening + 1, closing)
        );
        if (!/^[\s}]*$/.test(source.slice(closing + 1))) {
          return { reading: null, ambiguous: true };
        }
      } else {
        return { reading: null, ambiguous: true };
      }
    } else {
      return { reading: null, ambiguous: true };
    }
  }

  return {
    reading: {
      paragraphs: recoveredSpans
        .map((spans) => ({ spans }))
        .filter((paragraph) => paragraph.spans.length > 0),
      question,
    },
    ambiguous: false,
  };
}

function parseStructuredReading(
  value: unknown,
  noteTexts: readonly string[] = [],
  validateQuotes = false
): NormalizedReading | null {
  if (
    !hasOnlyKeys(value, ["paragraphs", "question"]) ||
    !Array.isArray(value.paragraphs) ||
    value.paragraphs.length < 1 ||
    value.paragraphs.length > 3 ||
    typeof value.question !== "string"
  ) return null;

  const paragraphs: ReadingParagraph[] = [];
  for (const paragraph of value.paragraphs) {
    if (
      !hasOnlyKeys(paragraph, ["spans"]) ||
      !Array.isArray(paragraph.spans) ||
      paragraph.spans.length === 0
    ) return null;
    const spans: ReadingSpan[] = [];
    for (const span of paragraph.spans) {
      if (
        !hasOnlyKeys(span, ["text", "quote"]) ||
        typeof span.text !== "string" ||
        span.text.length === 0 ||
        typeof span.quote !== "boolean"
      ) return null;
      spans.push({
        text: span.text,
        quote:
          span.quote &&
          (!validateQuotes ||
            noteTexts.some((noteText) => noteText.includes(span.text as string))),
      });
    }
    paragraphs.push({ spans });
  }
  return {
    paragraphs,
    question: value.question.trim(),
  };
}

function parseTrailingQuestionReading(
  value: unknown,
  noteTexts: readonly string[]
): NormalizedReading | null {
  if (
    !hasOnlyKeys(value, ["paragraphs"]) ||
    !Array.isArray(value.paragraphs) ||
    value.paragraphs.length < 2 ||
    value.paragraphs.length > 4
  ) return null;
  const finalItem = value.paragraphs[value.paragraphs.length - 1];
  if (
    !hasOnlyKeys(finalItem, ["question"]) ||
    typeof finalItem.question !== "string"
  ) return null;

  const paragraphs: ReadingParagraph[] = [];
  for (const paragraph of value.paragraphs.slice(0, -1)) {
    if (
      !hasOnlyKeys(paragraph, ["spans"]) ||
      !Array.isArray(paragraph.spans) ||
      paragraph.spans.length === 0
    ) return null;
    const spans: ReadingSpan[] = [];
    for (const span of paragraph.spans) {
      if (
        !hasOnlyKeys(span, ["text"], ["quote"]) ||
        typeof span.text !== "string" ||
        span.text.length === 0 ||
        (span.quote !== undefined && typeof span.quote !== "boolean")
      ) return null;
      spans.push({
        text: span.text,
        quote:
          span.quote === true &&
          noteTexts.some((noteText) => noteText.includes(span.text as string)),
      });
    }
    paragraphs.push({ spans });
  }
  return { paragraphs, question: finalItem.question.trim() };
}

function parseLegacyPayload(
  candidate: string,
  noteTexts: readonly string[]
): NormalizedReading | null {
  try {
    const value: unknown = JSON.parse(candidate);
    return (
      parseStructuredReading(value, noteTexts, true) ??
      parseTrailingQuestionReading(value, noteTexts)
    );
  } catch {
    const recovered = recoverMalformedReading(candidate);
    return recovered.reading
      ? parseStructuredReading(recovered.reading, noteTexts, true)
      : null;
  }
}

/**
 * Reading documents before the structured-field fix stored the model output
 * in `text`. Only a string that looks like an object is parsed, and only if
 * it has the expected paragraphs/spans shape. Every other legacy value stays
 * readable as one ordinary, non-quoted paragraph.
 */
export function normalizeStoredReading(
  data: unknown,
  noteTexts: readonly string[] = []
): NormalizedReading {
  return normalizeStoredReadingWithNotes(data, noteTexts);
}

export function normalizeStoredReadingWithNotes(
  data: unknown,
  noteTexts: readonly string[]
): NormalizedReading {
  if (!isRecord(data)) return plainTextReading("");

  // The exact one-span envelope is the only structured document interpreted
  // as a legacy nested payload.
  const nestedText = nestedPayloadText(data);
  if (nestedText) {
    return (
      parseLegacyPayload(nestedText, noteTexts) ??
      plainTextReading("")
    );
  }

  // Otherwise canonical structured fields are authoritative even if a stale
  // legacy `text` field remains on the document.
  const canonical = parseStructuredReading(
    { paragraphs: data.paragraphs, question: data.question }
  );
  if (canonical) return canonical;

  const legacyText = typeof data.text === "string" ? data.text : null;
  if (legacyText !== null) {
    const candidate = legacyText.trimStart();
    if (candidate.startsWith("{")) {
      const parsed = parseLegacyPayload(candidate, noteTexts);
      if (parsed) return unwrapNestedReading(parsed, noteTexts);
    }
    return plainTextReading(legacyText);
  }

  return plainTextReading("");
}

function nestedPayloadText(data: Record<string, unknown>): string | null {
  if (
    !Array.isArray(data.paragraphs) ||
    data.paragraphs.length !== 1 ||
    !hasOnlyKeys(data.paragraphs[0], ["spans"]) ||
    !Array.isArray(data.paragraphs[0].spans) ||
    data.paragraphs[0].spans.length !== 1 ||
    (data.question !== undefined &&
      (typeof data.question !== "string" ||
        data.question.trim().length > 0))
  ) {
    return null;
  }
  const span = data.paragraphs[0].spans[0];
  if (
    !hasOnlyKeys(span, ["text"], ["quote"]) ||
    (span.quote !== false && span.quote !== undefined) ||
    typeof span.text !== "string"
  ) {
    return null;
  }
  const candidate = span.text.trim();
  if (
    candidate.startsWith("{") &&
    candidate.endsWith("}") &&
    candidate.includes('"paragraphs"')
  ) {
    return candidate;
  }
  return null;
}

function unwrapNestedReading(
  reading: NormalizedReading,
  noteTexts: readonly string[]
): NormalizedReading {
  const nestedText = nestedPayloadText(reading);
  if (!nestedText) return reading;
  return parseLegacyPayload(nestedText, noteTexts) ?? reading;
}

export function storedReadingNeedsQuoteValidation(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const legacyText = typeof data.text === "string" ? data.text.trim() : "";
  if (
    legacyText.startsWith("{") &&
    legacyText.includes('"paragraphs"')
  ) {
    return true;
  }
  return nestedPayloadText(data) !== null;
}
