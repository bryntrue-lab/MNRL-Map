"use strict";

/**
 * Mineral — the Pattern Engine (Task D, Slice D.1).
 *
 * The first commitment, mechanically enforced: this module COUNTS and QUOTES
 * verbatim. It never interprets, diagnoses, or names what the user is doing.
 * There is no LLM here — lexicon matching plus stopword-filtered word/phrase
 * frequency only.
 *
 * What it writes (Admin SDK only; clients are rules-locked out of patterns):
 *   users/{uid}/patterns/thread     — recurring language: words + 2–5-word
 *                                     phrases, counted once per note.
 *   users/{uid}/patterns/motif      — lexicon-matched imagery (motifLexicon,
 *                                     keyType 'motif').
 *   users/{uid}/patterns/resistance — lexicon-matched resistance entries
 *                                     (keyType 'resistance').
 *
 * Counts are NOTE counts: an item increments once per note it appears in,
 * so "appears in 4 of your 9 notes" is literally itemCounts[item].
 *
 * Idempotency: each pattern doc carries a `processed` ledger (array of
 * fieldNote ids, capped). The ledger lives on the pattern docs — never on
 * the fieldNote — because clients own fieldNotes.
 *
 * Reversal: contributions are recomputed from the deleted note's own content
 * (the delete event carries the final snapshot), so a deleted note leaves no
 * residue — counts decrement, its exemplars vanish, its ledger entry goes.
 */

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// ─────────────────────────────────────────────────────────────
// STOPWORDS (~200 common English words). Everything else is kept —
// including the user's odd words. Odd words are the good ones.
// ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are arent as at be " +
    "because been before being below between both but by cant cannot could " +
    "couldnt did didnt do does doesnt doing dont down during each few for " +
    "from further had hadnt has hasnt have havent having he hed hell hes her " +
    "here heres hers herself him himself his how hows i id ill im ive if in " +
    "into is isnt it its itself lets me more most mustnt my myself no nor " +
    "not of off on once only or other ought our ours ourselves out over own " +
    "same shant she shed shell shes should shouldnt so some such than that " +
    "thats the their theirs them themselves then there theres these they " +
    "theyd theyll theyre theyve this those through to too under until up " +
    "very was wasnt we wed well were weve werent what whats when whens where " +
    "wheres which while who whos whom why whys with wont would wouldnt you " +
    "youd youll youre youve your yours yourself yourselves " +
    // conversational filler common in voice transcripts
    "just really quite kind sort like also even still yet ever never always " +
    "maybe perhaps around going got get gets getting went gone came come " +
    "comes coming say says said saying see sees seeing seen saw know knows " +
    "knowing knew known think thinks thinking thought want wants wanting " +
    "wanted make makes making made much many lot bit thing things something " +
    "anything everything nothing someone anyone everyone one two today " +
    "yesterday tomorrow now then again back way ways time times day days " +
    "keep keeps keeping kept feel feels feeling felt little big right left " +
    "first last next new old good bad yes okay ok oh um uh hmm " +
    // D.3d §3.1 — modal/auxiliary verbs
    "can could would should will shall may might must " +
    // Slice K — conversational fillers must never surface as language.
    "though exactly sure actually almost along already another anyway rather especially"
  )
    .split(/\s+/)
    .filter(Boolean)
);

// Phrase windows intentionally retain structural stopwords ("this work is"),
// but conversational fillers are never meaningful parts of a gathering item.
const CONVERSATIONAL_FILLERS = new Set([
  "though", "exactly", "sure", "actually", "almost", "along", "already",
  "another", "anyway", "really", "maybe", "quite", "rather", "perhaps",
  "especially",
]);

// ─────────────────────────────────────────────────────────────
// NORMALIZATION — lowercase, strip punctuation, light stemming
// (plurals, -ing/-ed). A small stemmer, not an NLP service.
// ─────────────────────────────────────────────────────────────

function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) {
    w = w.slice(0, -3);
    // "appearing" → "appear"; undouble "sitting" → "sit"
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }
  if (w.length > 4 && w.endsWith("ed")) {
    w = w.slice(0, -2);
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** lowercase, apostrophes removed (don't → dont), punctuation → space */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Stopwords pass through raw — stemming them mangles phrase keys
 *  ("this" → "thi"); only content words are stemmed. */
function stemToken(raw) {
  return STOPWORDS.has(raw) ? raw : stem(raw);
}

/** → [{ raw, stem, stop }] */
function tokenize(text) {
  return normalize(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({
      raw,
      stem: stemToken(raw),
      stop: STOPWORDS.has(raw) || STOPWORDS.has(stem(raw)) || raw.length < 2,
    }));
}

/** Verbatim sentences of the note, in order. */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// EXTRACTION — what one note contributes
// ─────────────────────────────────────────────────────────────

/**
 * Words: stemmed content words, each counted once per note.
 * Phrases: 2–5-word n-grams within unbroken runs of content words
 * (stopword-boundary-aware — a phrase never crosses or touches a stopword).
 * Each item maps to the first verbatim sentence containing it.
 */
function extractLanguage(content) {
  const sentences = splitSentences(content);
  const sentenceTokens = sentences.map((s) => tokenize(s));
  const items = new Map(); // item → verbatim sentence

  sentenceTokens.forEach((tokens, si) => {
    const sentence = sentences[si];
    // words
    for (const t of tokens) {
      if (!t.stop && !items.has(t.stem)) items.set(t.stem, sentence);
    }
    // PHRASE EXTRACTION v2: stopwords retained in the stream. Candidate
    // grams are 3–6-word windows containing at least TWO content words;
    // 2-word grams only when both words are content words. One count per
    // note per gram (the items map dedupes).
    for (let n = 2; n <= 6; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const win = tokens.slice(i, i + n);
        if (win.some((t) => CONVERSATIONAL_FILLERS.has(t.raw))) continue;
        const contentCount = win.reduce((c, t) => c + (t.stop ? 0 : 1), 0);
        if (n === 2 ? contentCount !== 2 : contentCount < 2) continue;
        const phrase = win.map((t) => t.stem).join(" ");
        if (!items.has(phrase)) items.set(phrase, sentence);
      }
    }
  });

  return items;
}

/** True if the stemmed term sequence occurs consecutively in tokens. */
function containsPhrase(tokens, termStems) {
  outer: for (let i = 0; i + termStems.length <= tokens.length; i++) {
    for (let j = 0; j < termStems.length; j++) {
      if (tokens[i + j].stem !== termStems[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Lexicon matching. lexicon: [{ key, terms: string[], keyType }].
 * Returns Map(key → { keyType, sentence }) — one hit per note per key.
 */
function extractMotifs(content, lexicon) {
  const sentences = splitSentences(content);
  const sentenceTokens = sentences.map((s) => tokenize(s));
  const hits = new Map();

  for (const entry of lexicon) {
    if (hits.has(entry.key)) continue;
    const termStemLists = (entry.terms || [])
      .map((term) => normalize(term).split(/\s+/).filter(Boolean).map(stemToken))
      .filter((l) => l.length > 0);
    for (let si = 0; si < sentenceTokens.length && !hits.has(entry.key); si++) {
      for (const termStems of termStemLists) {
        if (containsPhrase(sentenceTokens[si], termStems)) {
          hits.set(entry.key, { keyType: entry.keyType, sentence: sentences[si] });
          break;
        }
      }
    }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────
// PATTERN DOC MUTATION (pure helpers over plain doc data)
// ─────────────────────────────────────────────────────────────

const LEDGER_CAP = 1500; // "capped reasonably" — oldest ids fall off first
const EXEMPLAR_CAP = 3; // most recent kept
const FIRESTORE_DOCUMENT_LIMIT_BYTES = 1048576;
// Keep 24 KiB below Firestore's 1 MiB limit after applying its documented
// storage-size formula. This is a size safety margin, not a content cap.
const FIRESTORE_SAFE_DOCUMENT_BYTES = 1000 * 1024;

function emptyPatternDoc(patternType) {
  return {
    patternType,
    itemCounts: {},
    exemplars: {},
    offerings: {},
    itemNotes: {}, // item → contributing note ids (note-set rules)
    processed: [],
    updatedAt: null,
  };
}

/** note → exemplar entry (verbatim sentence + attribution material). */
function makeExemplar(sentence, noteId, note) {
  return {
    text: sentence,
    fieldNoteId: noteId,
    noteType: note.type ?? null,
    source: note.source ?? null,
    encounterRef: note.encounterRef ?? null,
    capturedAt: note.createdAt ?? Timestamp.now(),
  };
}

function applyAdd(doc, items, noteId, note) {
  if (!doc.itemNotes || typeof doc.itemNotes !== "object") doc.itemNotes = {};
  for (const [item, sentence] of items) {
    doc.itemCounts[item] = (doc.itemCounts[item] || 0) + 1;
    const notes = doc.itemNotes[item] || [];
    if (!notes.includes(noteId)) notes.push(noteId);
    doc.itemNotes[item] = notes.slice(-ITEM_NOTES_CAP);
    const list = doc.exemplars[item] || [];
    list.push(makeExemplar(sentence, noteId, note));
    // most recent kept, capped
    list.sort((a, b) => (a.capturedAt?.toMillis?.() ?? 0) - (b.capturedAt?.toMillis?.() ?? 0));
    doc.exemplars[item] = list.slice(-EXEMPLAR_CAP);
  }
  doc.processed.push(noteId);
  if (doc.processed.length > LEDGER_CAP) {
    doc.processed = doc.processed.slice(-LEDGER_CAP);
    // Watermark: ids trimmed from the ledger were the oldest processed
    // notes. Any note captured at/before this moment has been through the
    // pipeline — the floor keeps backfill/redelivery from recounting notes
    // whose ids have aged out of the capped ledger.
    doc.ledgerFloorAt = note.createdAt ?? Timestamp.now();
  }
}

// ── PHRASE v2 doc hygiene (thread doc only) ──────────────────

const PHRASE_ENTRY_CAP = 600;
const MERGED_PHRASE_WORD_CAP = 12;
const ITEM_NOTES_CAP = 50; // note-set ops only matter at small counts

const isPhrase = (key) => key.includes(" ");

/** contiguous word-subsequence test */
function contiguousSub(aWords, bWords) {
  outer: for (let i = 0; i + aWords.length <= bWords.length; i++) {
    for (let j = 0; j < aWords.length; j++) {
      if (bWords[i + j] !== aWords[j]) continue outer;
    }
    return true;
  }
  return false;
}

const noteSet = (doc, key) =>
  Array.isArray(doc.itemNotes?.[key]) ? doc.itemNotes[key] : [];

function sameNoteSet(doc, a, b) {
  const sa = noteSet(doc, a);
  const sb = noteSet(doc, b);
  // Sets of fewer than two notes never suppress or merge: every gram of a
  // single note trivially shares its note set — collapsing those would
  // destroy the count-1 inventory a FUTURE note needs to match against.
  if (sa.length < 2 || sa.length !== sb.length) return false;
  const set = new Set(sa);
  return sb.every((id) => set.has(id));
}

function dropItem(doc, key) {
  delete doc.itemCounts[key];
  delete doc.exemplars[key];
  delete doc.offerings[key];
  if (doc.itemNotes) delete doc.itemNotes[key];
}

/**
 * Subsumption (canonical form): drop phrase A when A is a contiguous
 * sub-sequence of phrase B AND noteSet(A) == noteSet(B). Note-set
 * equality, not count equality — coincidentally equal counts from
 * different notes must not suppress. (Word-vs-phrase suppression is
 * display-side only; words stay counted here so they can resurface.)
 */
function subsumePhrases(doc) {
  let changed = false;
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  const containerIndex = new Map();
  const addContainer = (subphrase, phrase) => {
    const containers = containerIndex.get(subphrase) ?? [];
    containers.push(phrase);
    containerIndex.set(subphrase, containers);
  };

  // Each longer phrase names every proper contiguous sub-phrase it could
  // subsume. Traversal stays in the original outer-A / inner-B insertion
  // order, which is important because dropping one phrase can affect a later
  // pair in the same pass.
  for (const b of phrases) {
    const words = b.split(" ");
    for (let start = 0; start < words.length - 1; start++) {
      for (let end = start + 2; end <= words.length; end++) {
        const a = words.slice(start, end).join(" ");
        if (a !== b) addContainer(a, b);
      }
    }
  }
  for (const a of phrases) {
    if (!(a in doc.itemCounts)) continue;
    for (const b of containerIndex.get(a) ?? []) {
      if (b in doc.itemCounts && sameNoteSet(doc, a, b)) {
        dropItem(doc, a);
        changed = true;
        break;
      }
    }
  }
  return changed;
}

/** Largest end-overlap union of two word sequences, or null.
 *  e.g. [this work is important to me] + [work is important to me and]
 *  → [this work is important to me and]. */
function overlapUnion(aWords, bWords) {
  let best = null;
  const tryDir = (x, y) => {
    // suffix of x == prefix of y, overlap k ≥ 1
    const max = Math.min(x.length, y.length) - 1;
    for (let k = max; k >= 1; k--) {
      let ok = true;
      for (let j = 0; j < k; j++) {
        if (x[x.length - k + j] !== y[j]) { ok = false; break; }
      }
      if (ok) {
        const union = [...x, ...y.slice(k)];
        if (!best || union.length < best.length) best = union;
        return;
      }
    }
  };
  tryDir(aWords, bWords);
  tryDir(bWords, aWords);
  return best;
}

/** True when every available exemplar of both items contains the run. */
function runAppearsInExemplars(doc, keys, runWords) {
  for (const key of keys) {
    for (const ex of doc.exemplars[key] || []) {
      const tokens = tokenize(ex.text).map((t) => t.stem);
      if (!contiguousSub(runWords, tokens)) return false;
    }
  }
  return true;
}

/** True when stored exemplars for `key` include every contributing note. */
function exemplarsCoverNoteSet(doc, key) {
  const covered = new Set((doc.exemplars[key] || []).map((e) => e.fieldNoteId));
  return noteSet(doc, key).every((id) => covered.has(id));
}

/**
 * MERGE overlapping siblings: two grams with identical note sets whose
 * token spans overlap in every contributing note are replaced by the
 * union run (may exceed the 6-word window; capped at 12 words). This is
 * what subsumption can't reach.
 */
function mergeOverlappingSiblings(doc) {
  let changed = false;
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  const phraseIndex = new Map(phrases.map((key, index) => [key, index]));
  const prefixIndex = new Map();
  const suffixIndex = new Map();
  const noteSetGroup = new Map();
  const groupKey = (key) => {
    const notes = noteSet(doc, key);
    // The old proof never merges a one-note phrase. Keeping those out of the
    // index is both equivalent and important for repeated common end words.
    return notes.length < 2 ? null : JSON.stringify([...notes].sort());
  };
  const add = (index, run, key) => {
    const entries = index.get(run) ?? [];
    entries.push(key);
    index.set(run, entries);
  };

  const indexPhrase = (key) => {
    // The legacy nested loops only visit keys present at the beginning of
    // this pass. A new union waits for the next fixpoint pass; an existing
    // key overwritten by a union must be re-indexed for later legacy-order
    // siblings in this pass.
    if (!phraseIndex.has(key)) return;
    const group = groupKey(key);
    noteSetGroup.set(key, group);
    if (!group) return;
    const words = key.split(" ");
    for (let size = 1; size < words.length; size++) {
      add(prefixIndex, `${group}\u0000${words.slice(0, size).join(" ")}`, key);
      add(suffixIndex, `${group}\u0000${words.slice(-size).join(" ")}`, key);
    }
  };

  // A merge is possible only when an end-run of one phrase equals an end-run
  // of the other. Index those runs first, then retain the original phrase
  // ordering while checking just the possible siblings. This preserves the
  // full exemplar-coverage proof below and avoids unrelated phrase pairs.
  for (const key of phrases) {
    indexPhrase(key);
  }

  for (const a of phrases) {
    if (!(a in doc.itemCounts)) continue;
    const group = noteSetGroup.get(a);
    if (!group) continue;
    const aWords = a.split(" ");
    const candidates = new Set();
    for (let size = 1; size < aWords.length; size++) {
      for (const b of prefixIndex.get(`${group}\u0000${aWords.slice(-size).join(" ")}`) ?? []) candidates.add(b);
      for (const b of suffixIndex.get(`${group}\u0000${aWords.slice(0, size).join(" ")}`) ?? []) candidates.add(b);
    }
    const orderedCandidates = [...candidates].sort(
      (left, right) => phraseIndex.get(left) - phraseIndex.get(right)
    );
    for (const b of orderedCandidates) {
      if (a === b || !(a in doc.itemCounts) || !(b in doc.itemCounts)) continue;
      if (!sameNoteSet(doc, a, b)) continue;
      const bWords = b.split(" ");
      if (contiguousSub(aWords, bWords) || contiguousSub(bWords, aWords)) continue; // subsumption's job
      const union = overlapUnion(aWords, bWords);
      if (!union || union.length > MERGED_PHRASE_WORD_CAP) continue;
      // Full-proof gate: exemplars are capped, so a merge is only sound
      // when the stored exemplars cover EVERY contributing note for both
      // keys — otherwise "overlaps in every contributing note" cannot be
      // verified and the merged count would rest on partial evidence.
      if (!exemplarsCoverNoteSet(doc, a) || !exemplarsCoverNoteSet(doc, b)) continue;
      if (!runAppearsInExemplars(doc, [a, b], union)) continue;
      const key = union.join(" ");
      const notes = noteSet(doc, a);
      const exemplars = [...(doc.exemplars[a] || []), ...(doc.exemplars[b] || [])]
        .filter((e, i, arr) => arr.findIndex((x) => x.fieldNoteId === e.fieldNoteId) === i)
        .sort((x, y) => (x.capturedAt?.toMillis?.() ?? 0) - (y.capturedAt?.toMillis?.() ?? 0))
        .slice(-EXEMPLAR_CAP);
      const count = doc.itemCounts[a];
      dropItem(doc, a);
      dropItem(doc, b);
      doc.itemCounts[key] = count;
      doc.exemplars[key] = exemplars;
      doc.itemNotes[key] = notes;
      indexPhrase(key);
      changed = true;
    }
  }
  return changed;
}

/** earliest contribution time for a key (0 when unknown). */
function earliestContribution(doc, key) {
  const list = doc.exemplars[key];
  if (!Array.isArray(list) || list.length === 0) return 0;
  return Math.min(...list.map((e) => e.capturedAt?.toMillis?.() ?? 0));
}

/**
 * Size control: when phrase entries exceed the cap, prune count-1
 * phrases, oldest contribution first. Silent.
 */
function prunePhrases(doc) {
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  let excess = phrases.length - PHRASE_ENTRY_CAP;
  if (excess <= 0) return;
  const singles = phrases
    .filter((k) => doc.itemCounts[k] === 1)
    .sort((x, y) => earliestContribution(doc, x) - earliestContribution(doc, y));
  for (const k of singles) {
    if (excess <= 0) break;
    dropItem(doc, k);
    excess -= 1;
  }
}

/** Subsume + merge to a fixpoint (merges can enable new subsumptions),
 *  then prune. Thread doc only. */
function phraseHygiene(doc) {
  for (let i = 0; i < 6; i++) {
    const a = subsumePhrases(doc);
    const b = mergeOverlappingSiblings(doc);
    if (!a && !b) break;
  }
  prunePhrases(doc);
}

function applyRemove(doc, items, noteId) {
  if (!doc.itemNotes || typeof doc.itemNotes !== "object") doc.itemNotes = {};
  // Everything this note contributed: its recomputed grams PLUS any item
  // whose note set contains it — merged phrases carry keys longer than
  // the extraction window, so recomputation alone can't find them.
  const contributed = new Set(items.keys());
  for (const [item, notes] of Object.entries(doc.itemNotes)) {
    if (Array.isArray(notes) && notes.includes(noteId)) contributed.add(item);
  }
  for (const item of contributed) {
    const next = (doc.itemCounts[item] || 0) - 1;
    if (next <= 0) {
      dropItem(doc, item);
    } else {
      doc.itemCounts[item] = next;
      if (doc.itemNotes[item]) {
        doc.itemNotes[item] = doc.itemNotes[item].filter((id) => id !== noteId);
      }
    }
  }
  // The note's exemplars vanish everywhere, whatever item they sat under.
  for (const item of Object.keys(doc.exemplars)) {
    const filtered = doc.exemplars[item].filter((e) => e.fieldNoteId !== noteId);
    if (filtered.length !== doc.exemplars[item].length) doc.exemplars[item] = filtered;
    if (filtered.length === 0) delete doc.exemplars[item];
  }
  doc.processed = doc.processed.filter((id) => id !== noteId);
}

// ─────────────────────────────────────────────────────────────
// ENGINE ENTRY POINTS
// ─────────────────────────────────────────────────────────────

async function loadLexicon(db) {
  const snap = await db.collection("motifLexicon").get();
  return motifLexiconFromDocs(snap.docs);
}

function motifLexiconFromDocs(docs) {
  return docs
    .map((d) => d.data())
    .filter((e) => e && e.key && Array.isArray(e.terms));
}

/**
 * The founder edits this document directly. It is deliberately loaded for
 * every rebuild: deploying code must never be required for a word change to
 * take effect.
 */
async function loadConsciousnessLexicon(db) {
  const snap = await db.doc("practitionerContent/consciousness_lexicon").get();
  return consciousnessLexiconFromData(snap.exists ? snap.data() : null);
}

function consciousnessLexiconFromData(data) {
  // `structures` is the original console document shape. `families` is the
  // explicit seed shape; accept both so a founder's live edit is never
  // overwritten merely to satisfy a later seed schema.
  const rawFamilies = data?.families ?? data?.structures;
  if (data?.kind !== "consciousness_lexicon" || !rawFamilies || typeof rawFamilies !== "object") {
    return {};
  }
  const families = {};
  for (const structure of ["magic", "mythic", "mental", "integral"]) {
    const terms = rawFamilies[structure];
    if (Array.isArray(terms)) {
      families[structure] = terms.filter((term) => typeof term === "string" && term.trim());
    }
  }
  return families;
}

function noteMillis(note) {
  const value = note?.createdAt;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

function noteIsReadable(note) {
  return (
    typeof note?.content === "string" &&
    note.content.trim().length > 0 &&
    note.transcriptStatus !== "pending" &&
    note.transcriptStatus !== "processing"
  );
}

function utcDayKey(ms) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : null;
}

function previousUtcDayKey(dayKey) {
  if (!dayKey) return null;
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function timeBucket(hour) {
  if (hour < 10) return "morning";
  if (hour < 17) return "midday";
  if (hour < 21) return "evening";
  return "night";
}

/**
 * Every evidence-valid weather is retained internally. Only the two hour
 * phrasings that the founder has approved become `findings`; other detected
 * weather is counted as unsupported and is never exposed as invented copy.
 */
function isApprovedHourFinding(finding) {
  return (
    (finding.type === "resistance" && finding.bucket === "night") ||
    (finding.type === "reflection" && finding.bucket === "morning")
  );
}

function deriveConditionsPattern(notes) {
  // This aggregate is built from the rebuild's existing full note scan. It
  // deliberately stores only the earliest timestamp, never note text, so
  // server-only consumers can calculate the Guide's elapsed field age without
  // opening fieldNote documents themselves.
  const allDatedNotes = notes
    .map((note) => ({ ...note, _ms: noteMillis(note) }))
    .filter((note) => note._ms > 0);
  const datedNotes = allDatedNotes.filter((note) => typeof note.type === "string");
  const firstNoteAt = allDatedNotes.reduce(
    (earliest, note) => (!earliest || note._ms < earliest._ms ? note : earliest),
    null
  )?.createdAt ?? null;
  const dayKeys = new Set(datedNotes.map((note) => utcDayKey(note._ms)).filter(Boolean));
  const byType = new Map();
  for (const note of datedNotes) {
    if (!Number.isInteger(note.localHour) || note.localHour < 0 || note.localHour > 23) continue;
    const item = byType.get(note.type) ?? { totalWithHour: 0, buckets: new Map() };
    item.totalWithHour += 1;
    const bucket = timeBucket(note.localHour);
    item.buckets.set(bucket, (item.buckets.get(bucket) ?? 0) + 1);
    byType.set(note.type, item);
  }

  const detected = [];
  for (const [type, item] of byType) {
    for (const [bucket, matchingCount] of item.buckets) {
      // Missing localHour values are intentionally absent from both sides.
      if (matchingCount >= 3 && matchingCount * 3 >= item.totalWithHour * 2) {
        detected.push({
          kind: "hour",
          type,
          bucket,
          matchingCount,
          totalWithHour: item.totalWithHour,
        });
      }
    }
  }

  // Gap evidence is calendar-only: it has no local-hour restriction. The
  // previous UTC creation day is known from Firestore; no local hour is ever
  // inferred for an older note.
  const qualifying = datedNotes.filter((note) => {
    const previous = previousUtcDayKey(utcDayKey(note._ms));
    return previous && !dayKeys.has(previous);
  });
  if (qualifying.length >= 3) {
    const typeCounts = new Map();
    for (const note of qualifying) {
      typeCounts.set(note.type, (typeCounts.get(note.type) ?? 0) + 1);
    }
    const ordered = [...typeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [type, count] = ordered[0] ?? [];
    const tied = ordered.length > 1 && ordered[1][1] === count;
    if (!tied && count * 2 >= qualifying.length) {
      detected.push({
        kind: "gap",
        type,
        matchingCount: count,
        totalQualifying: qualifying.length,
      });
    }
  }

  const approved = detected.filter(
    (finding) => finding.kind === "gap" || isApprovedHourFinding(finding)
  );
  return {
    patternType: "conditions",
    notesRead: datedNotes.length,
    daysRead: dayKeys.size,
    firstNoteAt,
    findings: approved,
    detectedFindings: detected,
    unsupportedFindingCount: detected.length - approved.length,
  };
}

function deriveConsciousnessPattern(notes, families) {
  const structureCounts = { magic: 0, mythic: 0, mental: 0, integral: 0 };
  const entries = Object.entries(families)
    .filter(([structure, terms]) => structure in structureCounts && Array.isArray(terms))
    .map(([key, terms]) => ({ key, terms, keyType: "consciousness" }));
  const freshest = new Map();
  const readable = notes
    .filter(noteIsReadable)
    .map((note) => ({ ...note, _ms: noteMillis(note) }))
    .sort((a, b) => a._ms - b._ms || String(a.id).localeCompare(String(b.id)));

  for (const note of readable) {
    const hits = extractMotifs(note.content, entries);
    for (const [structure, hit] of hits) {
      structureCounts[structure] += 1;
      freshest.set(structure, {
        ...makeExemplar(hit.sentence, note.id, note),
        structure,
        _ms: note._ms,
      });
    }
  }

  const highest = Math.max(...Object.values(structureCounts));
  if (highest === 0) {
    return { patternType: "consciousness", structureCounts, notesRead: readable.length, leading: null, exemplar: null };
  }
  const contenders = Object.keys(structureCounts).filter(
    (structure) => structureCounts[structure] === highest
  );
  contenders.sort((a, b) => {
    const aFresh = freshest.get(a);
    const bFresh = freshest.get(b);
    return (bFresh?._ms ?? 0) - (aFresh?._ms ?? 0) ||
      String(bFresh?.fieldNoteId ?? "").localeCompare(String(aFresh?.fieldNoteId ?? ""));
  });
  const leading = contenders[0];
  const exemplar = freshest.get(leading);
  if (exemplar) {
    delete exemplar._ms;
    delete exemplar.structure;
  }
  return {
    patternType: "consciousness",
    structureCounts,
    notesRead: readable.length,
    leading,
    exemplar: exemplar ?? null,
  };
}

/** offerings for matched keys, from practitionerContent (id: {keyType}_{slug}) */
async function loadOfferings(db, motifHits) {
  const wanted = offeringRequests(motifHits);
  const result = new Map(); // key → { key, text }
  await Promise.all(
    wanted.map(async ({ key, docId }) => {
      const snap = await db.collection("practitionerContent").doc(docId).get();
      const text = snap.exists ? snap.data().text : null;
      if (text) result.set(key, { key, text });
    })
  );
  return result;
}

function offeringRequests(motifHits) {
  return [...motifHits.entries()].map(([key, { keyType }]) => ({
    key,
    keyType,
    docId: `${keyType}_${key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  }));
}

function offeringsFromSnapshots(wanted, snaps) {
  const result = new Map(); // key → { key, text }
  wanted.forEach(({ key }, index) => {
    const snap = snaps[index];
    const text = snap?.exists ? snap.data().text : null;
    if (text) result.set(key, { key, text });
  });
  return result;
}

/**
 * A complete rebuild is the canonical path for the field-wide lenses. This
 * makes creates, edits, deletes, transcript arrivals, lexicon edits, and
 * stopword changes converge to the same result instead of attempting unsafe
 * reversible deltas for a user's entire field.
 */
const PATTERN_STATE_ID = "_state";
const EVENT_COALESCE_MS = 300;

async function claimPatternGeneration(db, uid) {
  const stateRef = db.doc(`users/${uid}/patterns/${PATTERN_STATE_ID}`);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(stateRef);
    const generation = Number(current.data()?.requestedGeneration ?? 0) + 1;
    tx.set(
      stateRef,
      { requestedGeneration: generation, dirtyAt: Timestamp.now() },
      { merge: true }
    );
    return generation;
  });
}

function generationDisposition(state, generation) {
  const requested = Number(state?.requestedGeneration ?? 0);
  const committed = Number(state?.committedGeneration ?? 0);
  if (requested === generation) return "commit";
  // A newer generation has already published the complete field, so this
  // invocation can safely stand down.
  if (committed >= generation) return "coalesced";

  // A newer claimant exists but has not committed. Returning a successful
  // coalescence here would lose the only durable retry if that claimant fails.
  // Eventarc retries this rejected field-note event; its retry claims a fresh
  // generation and restores convergence.
  const error = new Error("pattern rebuild superseded before a newer generation committed");
  error.code = "aborted";
  error.retryable = true;
  throw error;
}

function buildPatternDocs(noteRecords, motifLexicon, consciousnessLexicon) {
  const readable = noteRecords
    .filter(noteIsReadable)
    .sort((a, b) => noteMillis(a) - noteMillis(b) || a.id.localeCompare(b.id));
  const docs = {
    thread: emptyPatternDoc("thread"),
    motif: emptyPatternDoc("motif"),
    resistance: emptyPatternDoc("resistance"),
  };
  const offeringHits = new Map();

  for (const note of readable) {
    const language = extractLanguage(note.content);
    const motifHits = extractMotifs(note.content, motifLexicon);
    const motifItems = new Map();
    const resistanceItems = new Map();
    for (const [key, hit] of motifHits) {
      (hit.keyType === "resistance" ? resistanceItems : motifItems).set(key, hit.sentence);
      offeringHits.set(key, hit);
    }
    if (language.size) {
      applyAdd(docs.thread, language, note.id, note);
      phraseHygiene(docs.thread);
    }
    if (motifItems.size) applyAdd(docs.motif, motifItems, note.id, note);
    if (resistanceItems.size) applyAdd(docs.resistance, resistanceItems, note.id, note);
  }
  return {
    docs,
    offeringHits,
    readable,
    consciousness: deriveConsciousnessPattern(noteRecords, consciousnessLexicon),
    conditions: deriveConditionsPattern(noteRecords),
  };
}

/**
 * Keep the established document shape while it fits. Rebuilds no longer use
 * the incremental ledger, but installed clients still read it and thread note
 * sets. Only an oversized thread document receives the explicit compact
 * schema: it removes reconstructible thread note-set duplication while
 * retaining the ledger, every count, offering, and verbatim exemplar sentence.
 */
function firestoreStringBytes(value) {
  return Buffer.byteLength(value, "utf8") + 1;
}

function firestoreDocumentNameBytes(path) {
  return path.split("/").reduce((total, segment) => total + Buffer.byteLength(segment, "utf8"), 16);
}

/** Firestore's documented storage-size formula for a value. */
function firestoreValueBytes(value) {
  if (value === null) return 1;
  if (typeof value === "string") return firestoreStringBytes(value);
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 8;
  // Admin SDK Timestamp and the diagnostic's timestamp test double.
  if (typeof value?.toMillis === "function" || value instanceof Date) return 8;
  if (Array.isArray(value)) {
    return value.reduce((total, entry) => total + firestoreValueBytes(entry), 0);
  }
  if (value && typeof value === "object") {
    return (
      32 +
      Object.entries(value).reduce(
        (total, [key, entry]) => total + firestoreStringBytes(key) + firestoreValueBytes(entry),
        0
      )
    );
  }
  throw new Error(`unsupported Firestore size-estimate value type: ${typeof value}`);
}

/** Firestore's documented document size: name + fields + 32 bytes. */
function firestoreDocumentBytes(path, doc) {
  return (
    firestoreDocumentNameBytes(path) +
    32 +
    Object.entries(doc).reduce(
      (total, [key, value]) => total + firestoreStringBytes(key) + firestoreValueBytes(value),
      0
    )
  );
}

function compactThreadStorageProjection(doc) {
  const compact = { ...doc, schemaVersion: 2 };
  delete compact.itemNotes;
  return compact;
}

function patternStorageProjectionForPath(type, path, doc) {
  if (firestoreDocumentBytes(path, doc) < FIRESTORE_SAFE_DOCUMENT_BYTES) return doc;
  if (type !== "thread") return doc;
  return compactThreadStorageProjection(doc);
}

function serializedDocumentBytes(doc) {
  return Buffer.byteLength(JSON.stringify(doc), "utf8");
}

function snapshotRevision(snap) {
  if (!snap?.exists) return null;
  const updateTime = snap.updateTime;
  if (typeof updateTime?.toMillis === "function") {
    return `${updateTime.toMillis()}:${updateTime.nanoseconds ?? 0}`;
  }
  // Firestore Admin snapshots always provide updateTime. Keeping the missing
  // marker explicit makes a lightweight test double fail closed rather than
  // silently turning this into a count-only freshness check.
  return "missing-revision";
}

function snapshotSetFingerprint(snap) {
  return snap.docs
    .map((doc) => `${doc.id}:${snapshotRevision(doc)}`)
    .sort()
    .join("|");
}

function rebuildInputFingerprint({ notesSnap, motifSnap, consciousnessSnap, offeringSnaps }) {
  return {
    notes: snapshotSetFingerprint(notesSnap),
    motifs: snapshotSetFingerprint(motifSnap),
    consciousness: snapshotRevision(consciousnessSnap),
    offerings: offeringSnaps
      .map((snap) => `${snap.ref.path}:${snapshotRevision(snap)}`)
      .sort()
      .join("|"),
  };
}

function sameRebuildInputs(left, right) {
  return (
    left.notes === right.notes &&
    left.motifs === right.motifs &&
    left.consciousness === right.consciousness &&
    left.offerings === right.offerings
  );
}

function staleRebuildInputError() {
  const error = new Error("pattern rebuild inputs changed before commit");
  error.code = "aborted";
  error.retryable = true;
  return error;
}

/**
 * The expensive, pure scan deliberately happens outside the transaction.
 * The short publishing transaction re-reads every input revision and fences
 * on `_state.requestedGeneration`; it can only publish the exact snapshot that
 * was built. A create/edit/delete or mutable-lexicon change therefore rejects
 * this generation instead of allowing stale output to win.
 */
async function rebuildPatternsForUser(uid, options = {}) {
  const db = getFirestore();
  const generation = await claimPatternGeneration(db, uid);
  if (options.coalesce) {
    await new Promise((resolve) => setTimeout(resolve, EVENT_COALESCE_MS));
  }

  const stateRef = db.doc(`users/${uid}/patterns/${PATTERN_STATE_ID}`);
  const notesRef = db.collection(`users/${uid}/fieldNotes`);
  const motifLexiconRef = db.collection("motifLexicon");
  const consciousnessLexiconRef = db.doc("practitionerContent/consciousness_lexicon");

  const [stateSnap, notesSnap, motifSnap, consciousnessSnap] = await Promise.all([
    stateRef.get(),
    notesRef.get(),
    motifLexiconRef.get(),
    consciousnessLexiconRef.get(),
  ]);
  if (generationDisposition(stateSnap.data(), generation) === "coalesced") {
    return { scanned: 0, processed: 0, unsupportedConditionFindings: 0, coalesced: true };
  }

  const noteRecords = notesSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
  const built = buildPatternDocs(
    noteRecords,
    motifLexiconFromDocs(motifSnap.docs),
    consciousnessLexiconFromData(consciousnessSnap.exists ? consciousnessSnap.data() : null)
  );
  const wantedOfferings = offeringRequests(built.offeringHits);
  const offeringRefs = wantedOfferings.map(({ docId }) =>
    db.collection("practitionerContent").doc(docId)
  );
  const offeringSnaps = await Promise.all(offeringRefs.map((ref) => ref.get()));
  const expectedInputs = rebuildInputFingerprint({
    notesSnap,
    motifSnap,
    consciousnessSnap,
    offeringSnaps,
  });

  return db.runTransaction(async (tx) => {
    const [liveStateSnap, liveNotesSnap, liveMotifSnap, liveConsciousnessSnap, ...liveOfferingSnaps] =
      await Promise.all([
        tx.get(stateRef),
        tx.get(notesRef),
        tx.get(motifLexiconRef),
        tx.get(consciousnessLexiconRef),
        ...offeringRefs.map((ref) => tx.get(ref)),
      ]);
    if (generationDisposition(liveStateSnap.data(), generation) === "coalesced") {
      return { scanned: 0, processed: 0, unsupportedConditionFindings: 0, coalesced: true };
    }
    const liveInputs = rebuildInputFingerprint({
      notesSnap: liveNotesSnap,
      motifSnap: liveMotifSnap,
      consciousnessSnap: liveConsciousnessSnap,
      offeringSnaps: liveOfferingSnaps,
    });
    if (!sameRebuildInputs(expectedInputs, liveInputs)) throw staleRebuildInputError();

    const offerings = offeringsFromSnapshots(wantedOfferings, liveOfferingSnaps);
    for (const [key, offering] of offerings) {
      const hit = built.offeringHits.get(key);
      if (hit?.keyType === "resistance") built.docs.resistance.offerings[key] = offering;
      else built.docs.motif.offerings[key] = offering;
    }

    const now = Timestamp.now();
    for (const [type, data] of Object.entries(built.docs)) {
      data.updatedAt = now;
      const ref = db.doc(`users/${uid}/patterns/${type}`);
      const projected = patternStorageProjectionForPath(type, ref.path, data);
      if (firestoreDocumentBytes(ref.path, projected) >= FIRESTORE_SAFE_DOCUMENT_BYTES) {
        const error = new Error(
          `pattern ${type} document exceeds the ${FIRESTORE_SAFE_DOCUMENT_BYTES}-byte Firestore safety budget after projection`
            + ` (hard limit ${FIRESTORE_DOCUMENT_LIMIT_BYTES} bytes)`
        );
        error.code = "resource-exhausted";
        throw error;
      }
      tx.set(ref, projected);
    }
    built.consciousness.updatedAt = now;
    built.conditions.updatedAt = now;
    tx.set(db.doc(`users/${uid}/patterns/consciousness`), built.consciousness);
    tx.set(db.doc(`users/${uid}/patterns/conditions`), built.conditions);
    tx.set(
      stateRef,
      { committedGeneration: generation, committedAt: now, dirtyAt: now },
      { merge: true }
    );

    return {
      scanned: notesSnap.size,
      processed: built.readable.length,
      unsupportedConditionFindings: built.conditions.unsupportedFindingCount,
      coalesced: false,
    };
  });
}

/**
 * Process one note's content into the pattern docs (or reverse it out).
 * direction: 'add' | 'remove'.
 */
async function updatePatternsForNote(uid, noteId, note, direction) {
  const db = getFirestore();
  const content = note.content;
  if (!content || typeof content !== "string" || !content.trim()) return;

  const lexicon = await loadLexicon(db);
  const language = extractLanguage(content);
  const motifHits = extractMotifs(content, lexicon);

  const motifItems = new Map();
  const resistanceItems = new Map();
  for (const [key, { keyType, sentence }] of motifHits) {
    (keyType === "resistance" ? resistanceItems : motifItems).set(key, sentence);
  }

  const offerings =
    direction === "add" ? await loadOfferings(db, motifHits) : new Map();

  const targets = [
    { type: "thread", items: language },
    { type: "motif", items: motifItems },
    { type: "resistance", items: resistanceItems },
  ];

  await db.runTransaction(async (tx) => {
    const refs = targets.map(({ type }) =>
      db.doc(`users/${uid}/patterns/${type}`)
    );
    const noteRef = db.doc(`users/${uid}/fieldNotes/${noteId}`);
    const [noteSnap, ...snaps] = await Promise.all([
      tx.get(noteRef),
      ...refs.map((r) => tx.get(r)),
    ]);

    // Delete-before-add race guard: events are at-least-once and not
    // causally ordered. If the note is already gone, an 'add' must not
    // reintroduce counts — there will be no later remove event for them.
    if (direction === "add" && !noteSnap.exists) return;

    targets.forEach(({ type, items }, i) => {
      const doc = snaps[i].exists
        ? { ...emptyPatternDoc(type), ...snaps[i].data() }
        : emptyPatternDoc(type);
      doc.processed = Array.isArray(doc.processed) ? doc.processed : [];

      const alreadyProcessed = doc.processed.includes(noteId);
      if (direction === "add") {
        if (alreadyProcessed) return; // double-processing guard
        // Ledger-floor guard: this note predates ids trimmed from the
        // capped ledger — it was processed long ago; never recount it.
        const floorMs = doc.ledgerFloorAt?.toMillis?.() ?? 0;
        const createdMs = note.createdAt?.toMillis?.() ?? 0;
        if (floorMs && createdMs && createdMs <= floorMs) return;
        if (items.size === 0) return; // nothing for this lens; no ledger noise
        applyAdd(doc, items, noteId, note);
        for (const [key] of items) {
          const offering = offerings.get(key);
          if (offering) doc.offerings[key] = offering;
        }
        if (type === "thread") phraseHygiene(doc);
      } else {
        if (!alreadyProcessed) return; // never counted here; nothing to reverse
        applyRemove(doc, items, noteId);
        // Same hygiene on removal — note sets that became equal must
        // subsume/merge now, matching a deterministic recomputation.
        if (type === "thread") phraseHygiene(doc);
      }

      doc.updatedAt = Timestamp.now();
      tx.set(refs[i], doc);
    });
  });
}

/**
 * Backfill (Slice D.3 Part A): run the SAME pipeline over every fieldNote
 * the ledgers have never seen. Notes created before the engine deployed
 * (or missed by a gap between deploys) get processed; nothing else changes.
 *
 * Idempotent by construction: a note already in a ledger is skipped here
 * (cheap pre-filter) and again inside the transaction (authoritative guard).
 * Notes whose extraction yields no items simply no-op.
 *
 * Returns { scanned, processed }.
 */
async function backfillPatternsForUser(uid, options = {}) {
  // Slice K's field-wide lenses must reflect mutable lexicon content and
  // reversible context changes. Rebuilding all five documents is also the
  // safest repair for the older three incremental documents.
  if (options.rebuild || options.fullRebuild) {
    return await rebuildPatternsForUser(uid);
  }
  const db = getFirestore();

  // Rebuild mode (migration): zero the caller's pattern docs, then
  // reprocess every note through the pipeline from scratch.
  if (options.rebuild) {
    await Promise.all(
      ["thread", "motif", "resistance"].map((type) =>
        db.doc(`users/${uid}/patterns/${type}`).delete()
      )
    );
  }

  // Union of the three ledgers — a note in ANY ledger has been through
  // the pipeline (docs only ledger notes that contributed to them, but
  // any note with extractable content lands in at least the thread doc,
  // and item-less notes are harmless to re-run).
  const patternSnap = await db.collection(`users/${uid}/patterns`).get();
  const seen = new Set();
  let ledgerFloorMs = 0;
  for (const d of patternSnap.docs) {
    const data = d.data();
    if (Array.isArray(data.processed)) for (const id of data.processed) seen.add(id);
    // Ledger-floor watermark: ids trimmed from a capped ledger belong to
    // notes captured at/before this time — already processed, never recount.
    const floor = data.ledgerFloorAt?.toMillis?.() ?? 0;
    if (floor > ledgerFloorMs) ledgerFloorMs = floor;
  }

  const notesSnap = await db.collection(`users/${uid}/fieldNotes`).get();
  let processed = 0;
  for (const noteDoc of notesSnap.docs) {
    if (seen.has(noteDoc.id)) continue;
    const note = noteDoc.data();
    const createdMs = note.createdAt?.toMillis?.() ?? 0;
    if (ledgerFloorMs && createdMs && createdMs <= ledgerFloorMs) continue;
    if (!note.content || typeof note.content !== "string" || !note.content.trim()) continue;
    // Audio notes wait for their transcript. Text notes carry
    // transcriptStatus 'none', so only genuinely in-flight states skip —
    // present content is the real signal that a note is ready.
    if (note.transcriptStatus === "pending" || note.transcriptStatus === "processing") continue;
    await updatePatternsForNote(uid, noteDoc.id, note, "add");
    processed += 1;
  }
  return { scanned: notesSnap.size, processed };
}

module.exports = {
  updatePatternsForNote,
  backfillPatternsForUser,
  rebuildPatternsForUser,
  // exported for the gate/test path
  extractLanguage,
  extractMotifs,
  deriveConditionsPattern,
  deriveConsciousnessPattern,
  generationDisposition,
  stem,
  STOPWORDS,
  // Pure helpers exposed only for deterministic equivalence/freshness tests.
  __test: {
    emptyPatternDoc,
    applyAdd,
    buildPatternDocs,
    consciousnessLexiconFromData,
    phraseHygiene,
    patternStorageProjectionForPath,
    serializedDocumentBytes,
    firestoreDocumentBytes,
    rebuildInputFingerprint,
    sameRebuildInputs,
  },
};
