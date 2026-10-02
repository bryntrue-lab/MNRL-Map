/* Narrow founder-authorized text-only update; no account access or other writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const admin = require("../functions/node_modules/firebase-admin");

const proposalPath = "attached_assets/motif-top-level-text-founder-review.json";
const htmlPath = "attached_assets/motif-top-level-text-founder-review.html";
const approvedHashes = {
  balance: "cb5ae1acddee415b60a708ad212642018c7da0882964fa63055dfe60c9bce46a",
  body: "c551461c5e4acd4a22efd9b7c5d14de3890b4cbebae77772a27f1f4b9d6e0bdd",
};
const rawHash = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");
function canonical(value) {
  if (value && typeof value.toJSON === "function") return canonical(value.toJSON());
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
const hash = (value) => rawHash(JSON.stringify(canonical(value)));
function checkTime(snapshot, expected) {
  assert.equal(snapshot.updateTime.seconds, expected.seconds, `${snapshot.id}: update seconds drift`);
  assert.equal(snapshot.updateTime.nanoseconds, expected.nanoseconds, `${snapshot.id}: update nanos drift`);
}
function checkDocument(snapshot, expected, id) {
  assert.equal(Boolean(snapshot), expected.exists, `${id}: existence drift`);
  if (!expected.exists) return;
  checkTime(snapshot, expected.updateTimeExact);
  assert.equal(hash(snapshot.data()), expected.documentSha256, `${id}: document fingerprint drift`);
}
const index = (query) => new Map(query.docs.map((doc) => [doc.id, doc]));

async function main() {
  assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--apply"),
    "Only --apply is accepted; otherwise validation is read-only.");
  const proposalBytes = fs.readFileSync(proposalPath, "utf8");
  const htmlBytes = fs.readFileSync(htmlPath, "utf8");
  const proposal = JSON.parse(proposalBytes);
  assert.equal(proposal.project, "mineral-resonance");
  assert.equal(proposal.database, "(default)");
  const entries = Object.keys(approvedHashes).map((key) => {
    const matches = proposal.entries.filter((entry) => entry.key === key);
    assert.equal(matches.length, 1);
    const entry = matches[0];
    assert.equal(entry.outcome, "propose-text");
    assert.equal(entry.targetDocumentId, `motif_${key}`);
    assert.equal(entry.siblingDocumentId, `word_${key}`);
    assert.equal(entry.keyType, "motif");
    // Explicit founder approval in this task supersedes the review artifact's pending authorization.
    assert.equal(rawHash(entry.proposedText), approvedHashes[key], `${key}: approved copy drift`);
    assert.equal(entry.proposedTextSha256, approvedHashes[key]);
    assert.ok(htmlBytes.includes(`<blockquote>${entry.proposedText}</blockquote>`),
      `${key}: HTML and JSON approved copy differ`);
    return entry;
  });
  const credentialValue = process.env.FIREBASE_SERVICE_ACCOUNT;
  assert.ok(credentialValue, "Existing FIREBASE_SERVICE_ACCOUNT is unavailable.");
  let credential;
  try { credential = JSON.parse(credentialValue); } catch { throw new Error("Firebase credential is not valid JSON."); }
  assert.equal(credential.project_id, proposal.project, "Credential project differs from approved project.");
  assert.ok(!process.env.FIRESTORE_EMULATOR_HOST, "Refusing emulator instead of approved live database.");
  admin.initializeApp({ credential: admin.credential.cert(credential), projectId: proposal.project });
  const db = admin.firestore();
  const apply = process.argv[2] === "--apply";
  const before = await db.runTransaction(async (tx) => {
    const content = index(await tx.get(db.collection("practitionerContent")));
    const lexicon = index(await tx.get(db.collection("motifLexicon")));
    assert.equal(content.size, proposal.snapshots.contentDocumentCount, "Content document-count drift");
    assert.equal(lexicon.size, proposal.snapshots.lexiconDocumentCount, "Lexicon document-count drift");
    for (const entry of proposal.entries) {
      const lex = lexicon.get(entry.lexiconDocumentId);
      assert.ok(lex, `${entry.key}: missing lexicon document`);
      checkTime(lex, entry.lexiconUpdateTimeExact);
      assert.equal(hash(lex.data()), entry.lexiconDocumentSha256, `${entry.key}: lexicon fingerprint drift`);
      checkDocument(content.get(entry.targetDocumentId), entry.targetBefore, entry.targetDocumentId);
      checkDocument(content.get(entry.siblingDocumentId), entry.siblingBefore, entry.siblingDocumentId);
    }
    for (const entry of entries) {
      const p = entry.provenance;
      assert.equal(p.collection, "practitionerContent");
      assert.ok([entry.targetDocumentId, entry.siblingDocumentId].includes(p.documentId));
      assert.equal(p.documentKey, entry.key);
      const source = content.get(p.documentId);
      checkTime(source, p.documentUpdateTimeExact);
      assert.equal(hash(source.data()), p.documentSha256, `${entry.key}: source fingerprint drift`);
      assert.equal(source.data().key, entry.key);
      assert.equal(source.data().keyType, p.documentKeyType);
      assert.equal(p.sourceRelationship, p.documentId === entry.targetDocumentId ? "own-motif" : "exact-word-sibling");
      const passage = source.data().passages[p.passageIndex];
      assert.equal(passage.status, "approved", `${entry.key}: source is not approved`);
      assert.equal(p.statusAtReview, "approved");
      assert.equal(hash(passage), p.passageSha256, `${entry.key}: passage fingerprint drift`);
      assert.equal(passage.text, p.originalPassageText, `${entry.key}: original passage drift`);
      assert.equal(rawHash(passage.text), p.originalPassageTextSha256);
      const bounds = p.extraction;
      assert.equal(bounds.type, "exact-sentence");
      assert.ok(Number.isInteger(bounds.startUtf16) && Number.isInteger(bounds.endUtf16Exclusive));
      assert.ok(bounds.startUtf16 >= 0 && bounds.endUtf16Exclusive <= passage.text.length);
      assert.ok(bounds.endUtf16Exclusive > bounds.startUtf16);
      assert.equal(passage.text.slice(bounds.startUtf16, bounds.endUtf16Exclusive), entry.proposedText);
      assert.ok(!Object.hasOwn(content.get(entry.targetDocumentId).data(), "text"));
    }
    assert.equal(fs.readFileSync(proposalPath, "utf8"), proposalBytes, "Local proposal changed during validation");
    assert.equal(fs.readFileSync(htmlPath, "utf8"), htmlBytes, "Local review changed during validation");
    if (apply) {
      for (const entry of entries) {
        const target = content.get(entry.targetDocumentId);
        tx.update(target.ref, { text: entry.proposedText }, { lastUpdateTime: target.updateTime });
      }
    }
    return { content, lexicon };
  });
  if (!apply) {
    console.log("READ-ONLY VALIDATION PASSED: exact fingerprints, update times, approved sources and both exact excerpts; zero writes.");
    return;
  }
  const afterContent = index(await db.collection("practitionerContent").get());
  const afterLexicon = index(await db.collection("motifLexicon").get());
  assert.equal(afterContent.size, before.content.size);
  assert.equal(afterLexicon.size, before.lexicon.size);
  for (const [id, snapshot] of before.content) {
    const after = afterContent.get(id);
    assert.ok(after, `${id}: missing after update`);
    const entry = entries.find((candidate) => candidate.targetDocumentId === id);
    if (entry) {
      assert.equal(after.data().text, entry.proposedText, `${id}: exact text verification failed`);
      const otherFields = { ...after.data() };
      delete otherFields.text;
      assert.equal(hash(otherFields), hash(snapshot.data()), `${id}: other fields changed`);
    } else {
      assert.equal(hash(after.data()), hash(snapshot.data()), `${id}: unrelated content changed`);
      assert.ok(after.updateTime.isEqual(snapshot.updateTime), `${id}: unrelated document rewritten`);
    }
  }
  for (const [id, snapshot] of before.lexicon) {
    const after = afterLexicon.get(id);
    assert.ok(after, `${id}: lexicon missing`);
    assert.equal(hash(after.data()), hash(snapshot.data()), `${id}: lexicon changed`);
    assert.ok(after.updateTime.isEqual(snapshot.updateTime), `${id}: lexicon rewritten`);
  }
  console.log(JSON.stringify({
    result: "COMMITTED_AND_VERIFIED",
    project: proposal.project,
    writes: entries.map((entry) => ({
      document: `practitionerContent/${entry.targetDocumentId}`,
      field: "text",
      textSha256: rawHash(afterContent.get(entry.targetDocumentId).data().text),
      updateTime: {
        seconds: afterContent.get(entry.targetDocumentId).updateTime.seconds,
        nanoseconds: afterContent.get(entry.targetDocumentId).updateTime.nanoseconds,
      },
    })),
    allOtherTargetFieldsPreserved: true,
    otherContentDocumentsUnchanged: before.content.size - entries.length,
    lexiconDocumentsUnchanged: before.lexicon.size,
    accountAccess: false,
  }, null, 2));
}
main().catch((error) => {
  // Assertion messages are deliberately bounded and never include credential contents.
  console.error(`STOPPED: ${error.message}`);
  process.exitCode = 1;
});