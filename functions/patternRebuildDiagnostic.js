"use strict";

/**
 * Read-only, redacted diagnostic for one explicitly selected field.
 *
 * Usage:
 *   PATTERN_TARGET_SHA256_PREFIX=<opaque-prefix> node functions/patternRebuildDiagnostic.js profile
 *   PATTERN_TARGET_SHA256_PREFIX=<opaque-prefix> node functions/patternRebuildDiagnostic.js verify
 *
 * It never writes Firestore and never prints UID, email, note IDs, note text,
 * credentials, timestamps, or pattern keys. Note content is held only in
 * process memory while profiling the current pattern engine.
 */

const crypto = require("node:crypto");
const cliAuth = require("firebase-tools/lib/auth");
const { CLOUD_PLATFORM } = require("firebase-tools/lib/scopes");
const { __test } = require("./patternEngine");

const project = "mineral-resonance";
const targetPrefix = process.env.PATTERN_TARGET_SHA256_PREFIX;
const mode = process.argv[2];

if (!/^[a-f0-9]{12,64}$/i.test(targetPrefix || "")) {
  throw new Error("PATTERN_TARGET_SHA256_PREFIX must be a 12–64 character hexadecimal prefix.");
}
if (!["profile", "verify"].includes(mode)) {
  throw new Error("Usage: ... patternRebuildDiagnostic.js profile|verify");
}

function firestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) {
    const millis = Date.parse(value.timestampValue);
    return { toMillis: () => millis };
  }
  if ("mapValue" in value) return firestoreFields(value.mapValue.fields || {});
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  return null;
}

function firestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, firestoreValue(value)])
  );
}

function documentData(document) {
  return firestoreFields(document.fields || {});
}

function documentId(document) {
  return document.name.split("/").at(-1);
}

function parentUserId(document) {
  return document.name.split("/").at(-3);
}

function utf8Bytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function threadStorageSummary(doc, path) {
  const stored = __test.splitPatternEvidenceForStorage(
    "thread",
    path,
    doc,
    0,
    new Date(0),
    { allowOversizeRoot: true }
  );
  const exemplarEntries = Object.values(doc.exemplars || {}).flat();
  const rootExemplarEntries = Object.values(stored.root.exemplars || {}).flat();
  return {
    // JSON totals are only a contribution comparison. Firestore totals use
    // the documented document-name/field/value formula.
    estimatedJsonBytesBeforeEvidenceSplit: utf8Bytes(doc),
    estimatedJsonBytesPrimaryRoot: utf8Bytes(stored.root),
    estimatedFirestoreBytesBeforeEvidenceSplit: __test.firestoreDocumentBytes(path, doc),
    estimatedFirestoreBytesPrimaryRoot: __test.firestoreDocumentBytes(path, stored.root),
    primaryExemplarsPerItem: stored.root.evidencePrimaryExemplarsPerItem,
    overflowPageCount: stored.pages.length,
    maxEstimatedOverflowPageBytes: stored.pages.reduce(
      (maximum, page) =>
        Math.max(
          maximum,
          __test.firestoreDocumentBytes(`${path}/evidence/${page.id}`, page.data)
        ),
      0
    ),
    rootFitsSafetyBudget:
      __test.firestoreDocumentBytes(path, stored.root) < 1000 * 1024,
    itemCountEntries: Object.keys(doc.itemCounts || {}).length,
    exemplarEntries: exemplarEntries.length,
    primaryExemplarEntries: rootExemplarEntries.length,
    overflowExemplarEntries: exemplarEntries.length - rootExemplarEntries.length,
    exemplarTextUtf8Bytes: exemplarEntries.reduce(
      (total, entry) => total + Buffer.byteLength(entry.text || "", "utf8"),
      0
    ),
    itemNoteEntries: Object.keys(doc.itemNotes || {}).length,
    itemNoteReferences: Object.values(doc.itemNotes || {}).reduce(
      (total, ids) => total + (Array.isArray(ids) ? ids.length : 0),
      0
    ),
    processedLedgerEntries: Array.isArray(doc.processed) ? doc.processed.length : 0,
  };
}

async function main() {
  const account = cliAuth.getProjectDefaultAccount(process.cwd());
  if (!account?.tokens?.refresh_token) {
    throw new Error("Firebase CLI authentication is required for this read-only diagnostic.");
  }
  const accessToken = (
    await cliAuth.getAccessToken(account.tokens.refresh_token, [CLOUD_PLATFORM])
  ).access_token;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const request = async (path, method = "GET", body) => {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/${path}`,
      { method, headers, body: body ? JSON.stringify(body) : undefined }
    );
    if (!response.ok) throw new Error(`Firestore read failed: HTTP ${response.status}`);
    return response.json();
  };
  const listDocuments = async (path) => {
    const documents = [];
    let pageToken;
    do {
      const query = new URLSearchParams({ pageSize: "200" });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await request(`${path}?${query}`);
      documents.push(...(page.documents || []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return documents;
  };

  // Collection-group filtering on notesRead requires a production index that
  // this diagnostic must not create. This scans pattern metadata only, then
  // selects one field by the supplied opaque hash in memory.
  const rows = await request("documents:runQuery", "POST", {
    structuredQuery: { from: [{ collectionId: "patterns", allDescendants: true }] },
  });
  const conditionDoc = rows
    .map((row) => row.document)
    .filter(Boolean)
    .find(
      (document) =>
        documentId(document) === "conditions" &&
        crypto
          .createHash("sha256")
          .update(parentUserId(document))
          .digest("hex")
          .startsWith(targetPrefix.toLowerCase())
    );
  if (!conditionDoc) throw new Error("No conditions document matches the supplied opaque prefix.");

  const userId = parentUserId(conditionDoc);
  const [userDocument, noteDocuments, motifRows, consciousnessDocument, patternDocuments] =
    await Promise.all([
      request(`documents/users/${encodeURIComponent(userId)}`),
      listDocuments(`documents/users/${encodeURIComponent(userId)}/fieldNotes`),
      request("documents:runQuery", "POST", {
        structuredQuery: { from: [{ collectionId: "motifLexicon" }] },
      }),
      request("documents/practitionerContent/consciousness_lexicon"),
      listDocuments(`documents/users/${encodeURIComponent(userId)}/patterns`),
    ]);

  const user = documentData(userDocument);
  const notes = noteDocuments.map((document) => ({
    id: documentId(document),
    ...documentData(document),
  }));
  const motifLexicon = motifRows
    .map((row) => row.document)
    .filter(Boolean)
    .map(documentData)
    .filter((entry) => entry && entry.key && Array.isArray(entry.terms));
  const consciousness = documentData(consciousnessDocument);
  const patterns = new Map(
    patternDocuments.map((document) => [documentId(document), documentData(document)])
  );
  const patternEvidenceDocuments = new Map(
    await Promise.all(
      ["thread", "motif", "resistance"].map(async (type) => [
        type,
        (await listDocuments(
          `documents/users/${encodeURIComponent(userId)}/patterns/${type}/evidence`
        )).map(documentData),
      ])
    )
  );

  if (mode === "profile") {
    const started = process.hrtime.bigint();
    const built = __test.buildPatternDocs(
      notes,
      motifLexicon,
      __test.consciousnessLexiconFromData(consciousness)
    );
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(
      JSON.stringify({
        mode,
        targetHashMatched: true,
        readingsEnabled: user.readingsEnabled === true,
        notesScanned: notes.length,
        notesProcessed: built.readable.length,
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        conditionsHasFirstNoteAt: Boolean(built.conditions.firstNoteAt),
        threadPhraseEntries: Object.keys(built.docs.thread.itemCounts).filter((key) =>
          key.includes(" ")
        ).length,
        threadStorage: threadStorageSummary(
          built.docs.thread,
          `users/${userId}/patterns/thread`
        ),
      })
    );
    return;
  }

  const expectedPatternIds = ["thread", "motif", "resistance", "consciousness", "conditions"];
  const expectedDocs = expectedPatternIds.map((id) => patterns.get(id)).filter(Boolean);
  const updateTimes = expectedDocs.map((data) => data.updatedAt?.toMillis?.()).filter(Boolean);
  const state = patterns.get("_state") || {};
  const conditions = patterns.get("conditions") || {};
  const evidenceConsistent = ["thread", "motif", "resistance"].every((type) => {
    const root = patterns.get(type) || {};
    const pageCount = Number(root.evidencePageCount || 0);
    const pages = patternEvidenceDocuments.get(type) || [];
    if (!Number.isInteger(pageCount) || pageCount < 0) return false;
    if (pageCount === 0) return true;
    const matching = pages
      .filter((page) => page.evidenceGeneration === root.evidenceGeneration)
      .sort((left, right) => Number(left.pageIndex) - Number(right.pageIndex));
    return matching.length === pageCount && matching.every((page, index) => page.pageIndex === index);
  });
  console.log(
    JSON.stringify({
      mode,
      targetHashMatched: true,
      readingsEnabled: user.readingsEnabled === true,
      notesScanned: notes.length,
      patternDocsPresent: expectedDocs.length === expectedPatternIds.length,
      conditionsNotesReadMatches: conditions.notesRead === notes.length,
      conditionsHasFirstNoteAt: Boolean(conditions.firstNoteAt),
      atomicUpdatedAt: updateTimes.length === expectedPatternIds.length && new Set(updateTimes).size === 1,
       evidenceGenerationConsistent: evidenceConsistent,
      generationCommitted:
        Number(state.requestedGeneration || 0) === Number(state.committedGeneration || 0),
    })
  );
}

main().catch((error) => {
  // Errors intentionally contain only operation/status information.
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});