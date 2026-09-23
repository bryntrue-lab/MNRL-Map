"use strict";

/**
 * Reading response handling lives outside the callable so the parsing
 * contract can be exercised without a Firestore emulator. The model is
 * allowed one more attempt when its response is not the expected object;
 * after that, ordinary prose is retained while recognizable JSON is replaced
 * by a safe, non-JSON fallback.
 */

const READING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "field_reading",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["paragraphs", "question"],
      properties: {
        paragraphs: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["spans"],
            properties: {
              spans: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["text", "quote"],
                  properties: {
                    text: { type: "string", minLength: 1 },
                    quote: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
        question: { type: "string" },
      },
    },
  },
};
const READING_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

function plainTextReading(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  return {
    paragraphs: [{ spans: [{ text, quote: false }] }],
    question: "",
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => keys.includes(key)) &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

/**
 * Find balanced JSON object candidates while respecting quoted braces. This
 * recovers the common "```json ...```" / short preamble failure without
 * attempting risky JSON repair (such as changing commas or quotation marks).
 */
function jsonObjectCandidates(rawText) {
  const text = rawText.trim().replace(/^\uFEFF/, "");
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim().replace(/^\\n|\\n$/g, ""));
  }
  const escapedFenced = text.match(
    /```(?:json)?(?:\\n)+([\s\S]*?)(?:\\n)+```/i
  );
  if (escapedFenced?.[1]) candidates.push(escapedFenced[1].trim());

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        // A short preamble is recoverable, but bytes after the completed
        // object are not: accepting a valid prefix would silently discard a
        // truncated or otherwise unexplained payload tail. Fenced JSON is
        // handled explicitly above.
        if (text.slice(index + 1).trim().length === 0) {
          candidates.push(text.slice(start, index + 1));
        }
        start = -1;
      }
    }
  }
  return candidates;
}

function parseReadingJson(rawText) {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    return null;
  }
  for (const candidate of jsonObjectCandidates(rawText)) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Try the next unambiguous candidate. We never mutate malformed JSON.
    }
  }
  return null;
}

const JSON_STRING_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/**
 * Decode a JSON string fragment without requiring the fragment itself to be
 * valid JSON. This is deliberately not a general-purpose JSON repairer:
 * only the escapes JSON defines are interpreted, while an unescaped quote
 * (the legacy failure this heals) is retained as ordinary prose.
 */
function decodeJsonStringFragment(fragment) {
  let text = "";
  for (let index = 0; index < fragment.length; index += 1) {
    if (fragment[index] !== "\\") {
      text += fragment[index];
      continue;
    }
    const escaped = fragment[index + 1];
    if (escaped === "u" && /^[0-9a-f]{4}$/i.test(fragment.slice(index + 2, index + 6))) {
      text += String.fromCharCode(parseInt(fragment.slice(index + 2, index + 6), 16));
      index += 5;
    } else if (Object.prototype.hasOwnProperty.call(JSON_STRING_ESCAPES, escaped)) {
      text += JSON_STRING_ESCAPES[escaped];
      index += 1;
    } else {
      // Preserve unknown escapes rather than inventing a replacement.
      text += "\\";
    }
  }
  return text;
}

function fieldOpening(source, key, fromIndex) {
  const keyIndex = source.indexOf(`"${key}"`, fromIndex);
  if (keyIndex < 0) return null;
  const colon = source.indexOf(":", keyIndex + key.length + 2);
  if (colon < 0) return null;
  let opening = colon + 1;
  while (/\s/.test(source[opening] ?? "")) opening += 1;
  return source[opening] === '"'
    ? { keyIndex, opening }
    : null;
}

/**
 * Recover only the narrow malformed shape that the old server persisted:
 * paragraphs/spans/text/quote/question, where prose contains an unescaped
 * quote. A span is accepted only when a quote boolean follows it in the
 * expected position. Ambiguous candidates are rejected rather than guessed.
 */
function recoverMalformedReading(rawText) {
  const source = typeof rawText === "string" ? rawText.trim() : "";
  const paragraphsKey = source.indexOf('"paragraphs"');
  if (paragraphsKey < 0) return { reading: null, ambiguous: false };
  const questionKey = source.indexOf('"question"', paragraphsKey);
  const bodyEnd = questionKey >= 0 ? questionKey : source.length;
  const spansKeys = [];
  const spansPattern = /"spans"\s*:\s*\[/g;
  spansPattern.lastIndex = paragraphsKey;
  for (let match = spansPattern.exec(source); match; match = spansPattern.exec(source)) {
    if (match.index >= bodyEnd) break;
    spansKeys.push(match.index);
  }
  if (spansKeys.length === 0) return { reading: null, ambiguous: false };

  const textPattern = /"text"\s*:/g;
  textPattern.lastIndex = paragraphsKey;
  const recoveredSpans = spansKeys.map(() => []);
  let textCount = 0;
  let finalQuoteValueEnd = -1;
  for (let match = textPattern.exec(source); match; match = textPattern.exec(source)) {
    if (match.index >= bodyEnd) break;
    textCount += 1;
    const opening = fieldOpening(source, "text", match.index)?.opening;
    if (opening === undefined) return { reading: null, ambiguous: true };

    const quotePattern = /,\s*"quote"\s*:\s*(true|false)/g;
    quotePattern.lastIndex = opening + 1;
    const quoteMatch = quotePattern.exec(source);
    if (!quoteMatch) return { reading: null, ambiguous: true };

    const nextText = source.indexOf('"text"', opening + 1);
    if (nextText >= 0 && quoteMatch.index > nextText) {
      return { reading: null, ambiguous: true };
    }

    // The quote marker must be preceded by the closing quote of this span.
    let closing = quoteMatch.index - 1;
    while (/\s/.test(source[closing] ?? "")) closing -= 1;
    if (source[closing] !== '"') return { reading: null, ambiguous: true };

    // A second marker before the next text key would make the extraction
    // ambiguous (for example, prose that itself contains ,"quote":true).
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
  if (textCount === 0 || recoveredSpans.every((spans) => spans.length === 0)) {
    return { reading: null, ambiguous: false };
  }
  // Every byte after the final span must be structural envelope syntax. The
  // old repair used to accept a short valid-looking prefix and silently drop
  // an arbitrarily large truncated tail.
  if (
    finalQuoteValueEnd < 0 ||
    !/^[\s}\],]*$/.test(
      source.slice(finalQuoteValueEnd, questionKey >= 0 ? questionKey : source.length)
    )
  ) {
    return { reading: null, ambiguous: true };
  }

  let question = "";
  if (questionKey >= 0) {
    const questionField = fieldOpening(source, "question", questionKey);
    if (!questionField) return { reading: null, ambiguous: true };
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
  }

  const paragraphs = recoveredSpans
    .map((spans) => ({ spans }))
    .filter((paragraph) => paragraph.spans.length > 0);
  return {
    reading: { paragraphs, question },
    ambiguous: false,
  };
}

function normalizeStructuredReading(parsed, noteTexts) {
  if (
    !isRecord(parsed) ||
    !hasOnlyKeys(parsed, ["paragraphs", "question"]) ||
    !Array.isArray(parsed.paragraphs) ||
    parsed.paragraphs.length === 0 ||
    parsed.paragraphs.length > 3 ||
    typeof parsed.question !== "string"
  ) {
    return null;
  }

  const notes = Array.isArray(noteTexts)
    ? noteTexts.filter((text) => typeof text === "string")
    : [];
  const paragraphs = [];
  for (const paragraph of parsed.paragraphs) {
    if (
      !hasOnlyKeys(paragraph, ["spans"]) ||
      !Array.isArray(paragraph.spans) ||
      paragraph.spans.length === 0
    ) {
      return null;
    }
    const spans = [];
    for (const span of paragraph.spans) {
      if (
        !hasOnlyKeys(span, ["text", "quote"]) ||
        typeof span.text !== "string" ||
        span.text.length === 0 ||
        typeof span.quote !== "boolean"
      ) {
        return null;
      }
      spans.push({
        text: span.text,
        // A quote is a typography instruction only after this exact,
        // case-sensitive substring check against the user's notes.
        quote:
          span.quote &&
          notes.some((noteText) => noteText.includes(span.text)),
      });
    }
    paragraphs.push({ spans });
  }

  return {
    paragraphs,
    question: parsed.question.trim(),
  };
}

/**
 * Normalize the one known misplaced-question response without dropping any
 * model prose. It is intentionally narrower than the canonical validator:
 * the root has only `paragraphs`, the final item has only `question`, and
 * every preceding item is a complete spans paragraph. Older models sometimes
 * omitted `quote`; omission means prose, never an unverified quotation.
 */
function normalizeTrailingQuestionReading(parsed, noteTexts) {
  if (
    !hasOnlyKeys(parsed, ["paragraphs"]) ||
    !Array.isArray(parsed.paragraphs) ||
    parsed.paragraphs.length < 2 ||
    parsed.paragraphs.length > 4
  ) {
    return null;
  }
  const finalItem = parsed.paragraphs[parsed.paragraphs.length - 1];
  if (
    !hasOnlyKeys(finalItem, ["question"]) ||
    typeof finalItem.question !== "string"
  ) {
    return null;
  }

  const notes = Array.isArray(noteTexts)
    ? noteTexts.filter((text) => typeof text === "string")
    : [];
  const paragraphs = [];
  for (const paragraph of parsed.paragraphs.slice(0, -1)) {
    if (
      !hasOnlyKeys(paragraph, ["spans"]) ||
      !Array.isArray(paragraph.spans) ||
      paragraph.spans.length === 0
    ) {
      return null;
    }
    const spans = [];
    for (const span of paragraph.spans) {
      if (
        !isRecord(span) ||
        Object.keys(span).some((key) => key !== "text" && key !== "quote") ||
        typeof span.text !== "string" ||
        span.text.length === 0 ||
        (span.quote !== undefined && typeof span.quote !== "boolean")
      ) {
        return null;
      }
      spans.push({
        text: span.text,
        quote:
          span.quote === true &&
          notes.some((noteText) => noteText.includes(span.text)),
      });
    }
    paragraphs.push({ spans });
  }
  return { paragraphs, question: finalItem.question.trim() };
}

function normalizeParsedReading(parsed, noteTexts) {
  return (
    normalizeStructuredReading(parsed, noteTexts) ??
    normalizeTrailingQuestionReading(parsed, noteTexts)
  );
}

function nestedPayloadText(reading) {
  if (
    !reading ||
    !Array.isArray(reading.paragraphs) ||
    reading.paragraphs.length !== 1 ||
    !Array.isArray(reading.paragraphs[0]?.spans) ||
    reading.paragraphs[0].spans.length !== 1 ||
    (reading.question !== undefined &&
      (typeof reading.question !== "string" ||
        reading.question.trim().length > 0))
  ) {
    return null;
  }
  const span = reading.paragraphs[0].spans[0];
  const candidate = typeof span?.text === "string" ? span.text.trim() : "";
  if (
    (span?.quote === false || span?.quote === undefined) &&
    candidate.startsWith("{") &&
    candidate.endsWith("}") &&
    candidate.includes('"paragraphs"')
  ) {
    return candidate;
  }
  return null;
}

function unwrapNestedReading(reading, noteTexts) {
  const nestedText = nestedPayloadText(reading);
  if (!nestedText) return reading;
  const parsed = parseReadingJson(nestedText);
  if (parsed) return normalizeParsedReading(parsed, noteTexts) ?? reading;
  const recovered = recoverMalformedReading(nestedText);
  return recovered.reading
    ? normalizeStructuredReading(recovered.reading, noteTexts) ?? reading
    : reading;
}

function parseReadingOutput(rawText, noteTexts) {
  const parsed = parseReadingJson(rawText);
  if (parsed) {
    const normalized = normalizeParsedReading(parsed, noteTexts);
    if (normalized) return unwrapNestedReading(normalized, noteTexts);
    const nestedText = nestedPayloadText(parsed);
    if (nestedText) {
      const nestedParsed = parseReadingJson(nestedText);
      if (nestedParsed) {
        return normalizeParsedReading(nestedParsed, noteTexts);
      }
      const recoveredNested = recoverMalformedReading(nestedText);
      return recoveredNested.reading
        ? normalizeStructuredReading(recoveredNested.reading, noteTexts)
        : null;
    }
    return null;
  }
  const recovered = recoverMalformedReading(rawText);
  return recovered.reading
    ? unwrapNestedReading(
        normalizeStructuredReading(recovered.reading, noteTexts),
        noteTexts
      )
    : null;
}

/**
 * Normalize one response without making a generation request. This is also
 * used by tests and is intentionally safe for already-stored plain text.
 */
function normalizeReading(rawText, noteTexts) {
  const reading = parseReadingOutput(rawText, noteTexts);
  if (reading) return reading;
  // Never render a recognizable JSON payload as serif prose. If it parsed as
  // an object but failed the atomic contract, use a neutral safe fallback.
  const recognizableJson =
    typeof rawText === "string" &&
    rawText.trimStart().startsWith("{") &&
    rawText.includes('"paragraphs"');
  return parseReadingJson(rawText) || recognizableJson
    ? plainTextReading("the reading did not arrive.")
    : plainTextReading(rawText);
}

function completionRequest({
  apiKey,
  model,
  systemPrompt,
  userMessage,
}) {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: READING_RESPONSE_FORMAT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  };
}

/**
 * Ask for a structured reading, retrying only when the response cannot be
 * parsed into the expected shape. HTTP/API failures remain terminal errors;
 * they should not be mistaken for readable model output.
 */
async function requestStructuredReading({
  fetchImpl = fetch,
  apiKey,
  model = "gpt-4o-mini",
  systemPrompt,
  userMessage,
  noteTexts,
  telemetry = console,
}) {
  let lastRawText = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(
      READING_COMPLETIONS_URL,
      completionRequest({ apiKey, model, systemPrompt, userMessage })
    );
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(
        `reading generation failed (${response.status}): ${detail.slice(0, 500)}`
      );
      error.status = response.status;
      throw error;
    }

    const completion = await response.json();
    const rawText = completion?.choices?.[0]?.message?.content;
    if (typeof rawText !== "string" || rawText.trim().length === 0) {
      throw new Error("the reading did not arrive.");
    }
    lastRawText = rawText;

    const reading = parseReadingOutput(rawText, noteTexts);
    if (reading) {
      telemetry.info?.("reading_parse", {
        outcome: "success",
        attempt: attempt + 1,
      });
      return reading;
    }
    telemetry.warn?.("reading_parse", {
      outcome: attempt === 0 ? "retry" : "fallback",
      attempt: attempt + 1,
      parseableJson: parseReadingJson(rawText) !== null,
    });
  }

  return normalizeReading(lastRawText, noteTexts);
}

module.exports = {
  READING_RESPONSE_FORMAT,
  normalizeReading,
  normalizeTrailingQuestionReading,
  normalizeStructuredReading,
  parseReadingJson,
  parseReadingOutput,
  plainTextReading,
  recoverMalformedReading,
  requestStructuredReading,
};