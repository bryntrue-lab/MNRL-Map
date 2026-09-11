"use strict";

/**
 * Frozen pre-index phrase-hygiene baseline.
 *
 * This is a test-only copy of the pairwise implementation that existed before
 * the indexed traversal. It intentionally has no dependency on the live
 * pattern engine, so a later production edit cannot turn the differential test
 * into a self-comparison. Update it only when deliberately replacing the
 * product's established phrase semantics, with a new baseline review.
 */

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
    "just really quite kind sort like also even still yet ever never always " +
    "maybe perhaps around going got get gets getting went gone came come " +
    "comes coming say says said saying see sees seeing seen saw know knows " +
    "knowing knew known think thinks thinking thought want wants wanting " +
    "wanted make makes making made much many lot bit thing things something " +
    "anything everything nothing someone anyone everyone one two today " +
    "yesterday tomorrow now then again back way ways time times day days " +
    "keep keeps keeping kept feel feels feeling felt little big right left " +
    "first last next new old good bad yes okay ok oh um uh hmm " +
    "can could would should will shall may might must " +
    "though exactly sure actually almost along already another anyway rather especially"
  )
    .split(/\s+/)
    .filter(Boolean)
);

function stem(word) {
  let value = word;
  if (value.length > 4 && value.endsWith("ies")) return value.slice(0, -3) + "y";
  if (value.length > 5 && value.endsWith("ing")) {
    value = value.slice(0, -3);
    if (value.length > 2 && value[value.length - 1] === value[value.length - 2]) {
      value = value.slice(0, -1);
    }
    return value;
  }
  if (value.length > 4 && value.endsWith("ed")) {
    value = value.slice(0, -2);
    if (value.length > 2 && value[value.length - 1] === value[value.length - 2]) {
      value = value.slice(0, -1);
    }
    return value;
  }
  if (value.length > 3 && value.endsWith("es") && !value.endsWith("ses")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({
      stem: STOPWORDS.has(raw) ? raw : stem(raw),
    }));
}

const isPhrase = (key) => key.includes(" ");
const noteSet = (doc, key) =>
  Array.isArray(doc.itemNotes?.[key]) ? doc.itemNotes[key] : [];

function contiguousSub(aWords, bWords) {
  outer: for (let i = 0; i + aWords.length <= bWords.length; i++) {
    for (let j = 0; j < aWords.length; j++) {
      if (aWords[j] !== bWords[i + j]) continue outer;
    }
    return true;
  }
  return false;
}

function sameNoteSet(doc, a, b) {
  const sa = noteSet(doc, a);
  const sb = noteSet(doc, b);
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

function subsumePhrases(doc) {
  let changed = false;
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  for (const a of phrases) {
    if (!(a in doc.itemCounts)) continue;
    const aWords = a.split(" ");
    for (const b of phrases) {
      if (a === b || !(b in doc.itemCounts)) continue;
      const bWords = b.split(" ");
      if (bWords.length <= aWords.length) continue;
      if (sameNoteSet(doc, a, b) && contiguousSub(aWords, bWords)) {
        dropItem(doc, a);
        changed = true;
        break;
      }
    }
  }
  return changed;
}

function overlapUnion(aWords, bWords) {
  let best = null;
  const tryDir = (x, y) => {
    const max = Math.min(x.length, y.length) - 1;
    for (let k = max; k >= 1; k--) {
      let ok = true;
      for (let j = 0; j < k; j++) {
        if (x[x.length - k + j] !== y[j]) {
          ok = false;
          break;
        }
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

function runAppearsInExemplars(doc, keys, runWords) {
  for (const key of keys) {
    for (const exemplar of doc.exemplars[key] || []) {
      const tokens = tokenize(exemplar.text).map((token) => token.stem);
      if (!contiguousSub(runWords, tokens)) return false;
    }
  }
  return true;
}

function exemplarsCoverNoteSet(doc, key) {
  const covered = new Set((doc.exemplars[key] || []).map((entry) => entry.fieldNoteId));
  return noteSet(doc, key).every((id) => covered.has(id));
}

function mergeOverlappingSiblings(doc) {
  let changed = false;
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  for (const a of phrases) {
    if (!(a in doc.itemCounts)) continue;
    for (const b of phrases) {
      if (a === b || !(a in doc.itemCounts) || !(b in doc.itemCounts)) continue;
      if (!sameNoteSet(doc, a, b)) continue;
      const aWords = a.split(" ");
      const bWords = b.split(" ");
      if (contiguousSub(aWords, bWords) || contiguousSub(bWords, aWords)) continue;
      const union = overlapUnion(aWords, bWords);
      if (!union || union.length > 12) continue;
      if (!exemplarsCoverNoteSet(doc, a) || !exemplarsCoverNoteSet(doc, b)) continue;
      if (!runAppearsInExemplars(doc, [a, b], union)) continue;
      const key = union.join(" ");
      const notes = noteSet(doc, a);
      const exemplars = [...(doc.exemplars[a] || []), ...(doc.exemplars[b] || [])]
        .filter((entry, index, all) => all.findIndex((candidate) => candidate.fieldNoteId === entry.fieldNoteId) === index)
        .sort((left, right) => (left.capturedAt?.toMillis?.() ?? 0) - (right.capturedAt?.toMillis?.() ?? 0))
        .slice(-3);
      const count = doc.itemCounts[a];
      dropItem(doc, a);
      dropItem(doc, b);
      doc.itemCounts[key] = count;
      doc.exemplars[key] = exemplars;
      doc.itemNotes[key] = notes;
      changed = true;
    }
  }
  return changed;
}

function earliestContribution(doc, key) {
  const list = doc.exemplars[key];
  if (!Array.isArray(list) || list.length === 0) return 0;
  return Math.min(...list.map((entry) => entry.capturedAt?.toMillis?.() ?? 0));
}

function prunePhrases(doc) {
  const phrases = Object.keys(doc.itemCounts).filter(isPhrase);
  let excess = phrases.length - 600;
  if (excess <= 0) return;
  const singles = phrases
    .filter((key) => doc.itemCounts[key] === 1)
    .sort((left, right) => earliestContribution(doc, left) - earliestContribution(doc, right));
  for (const key of singles) {
    if (excess <= 0) break;
    dropItem(doc, key);
    excess -= 1;
  }
}

function phraseHygiene(doc) {
  for (let i = 0; i < 6; i++) {
    const a = subsumePhrases(doc);
    const b = mergeOverlappingSiblings(doc);
    if (!a && !b) break;
  }
  prunePhrases(doc);
}

module.exports = { phraseHygiene };