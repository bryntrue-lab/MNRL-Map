#!/usr/bin/env node
'use strict';

// REVIEW ONLY: the sole remote calls are GETs of these two content collections.
const admin = require('firebase-admin');
const fs = require('node:fs');
const crypto = require('node:crypto');
const SNAPSHOT = '/tmp/mineral-motif-content-review-snapshot.json';
const PROJECT = 'mineral-resonance';
const OUTPUT_BASE = 'attached_assets/motif-top-level-text-founder-review';
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const slug = key => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const textHash = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function report() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const docs = new Map(snapshot.content.map(record => [record.id, record]));
  const selections = {
    balance: {
      documentId: 'motif_balance', passageIndex: 2,
      text: 'The Buddhist tradition speaks of the Middle Way, a path that avoids extremes and seeks balance in all aspects of life.',
      rationale: 'A complete, concise sentence directly naming balance and retaining its Buddhist framing. More immediately usable as a held line than the longer Greek philosophical explanation or Feng Shui prosperity claim; selected from the motif’s own approved passage.',
    },
    body: {
      documentId: 'word_body', passageIndex: 1,
      text: 'In the practice of yoga, the body has been honored as a temple, a space where breath and movement unite.',
      rationale: 'A concrete, embodied sentence joining breath and movement while preserving its yoga attribution. Stronger as a standalone line than the own-document soul-vessel framing or broader metaphysical claims. The exact word_body sibling is allowed as source; this does not relabel or alter that document.',
    },
  };
  const state = record => record ? {
    exists: true, updateTime: record.updateTime, updateTimeExact: record.updateTimeExact,
    documentSha256: hash(record.data),
    kind: record.data.kind ?? null, key: record.data.key ?? null,
    keyType: record.data.keyType ?? null,
    topLevelTextFieldPresent: Object.hasOwn(record.data, 'text'),
    topLevelText: record.data.text ?? null,
    passages: (record.data.passages ?? []).map((passage, passageIndex) => ({
      passageIndex, status: passage.status ?? null, source: passage.source ?? null,
      passageSha256: hash(passage), textSha256: typeof passage.text === 'string' ? textHash(passage.text) : null,
    })),
  } : { exists: false };
  const entries = snapshot.lexicon.map(lexicon => {
    const { key, keyType } = lexicon.data;
    if (!nonempty(key) || keyType !== 'motif') throw new Error('unexpected-lexicon-shape');
    const targetDocumentId = `motif_${slug(key)}`;
    const siblingDocumentId = `word_${slug(key)}`;
    const own = docs.get(targetDocumentId);
    const sibling = docs.get(siblingDocumentId);
    const candidates = [own, sibling].filter(Boolean).flatMap(record =>
      (record.data.passages ?? []).flatMap((passage, passageIndex) =>
        passage.status === 'approved' && nonempty(passage.text) ? [{
          documentId: record.id, passageIndex, status: passage.status, source: passage.source,
          locator: passage.locator ?? null, originalPassageText: passage.text,
          passageSha256: hash(passage), textSha256: textHash(passage.text),
        }] : []));
    const entry = {
      key, keyType, lexiconDocumentId: lexicon.id,
      lexiconDocumentSha256: hash(lexicon.data), lexiconUpdateTimeExact: lexicon.updateTimeExact,
      targetDocumentId, siblingDocumentId, targetBefore: state(own), siblingBefore: state(sibling),
      outcome: null, proposedText: null, approval: { status: 'pending', approvedBy: null, approvedAt: null },
      provenance: null, rationale: null, eligibleApprovedPassages: [],
    };
    if (own && nonempty(own.data.text)) {
      entry.outcome = 'preserve-existing';
      entry.approval.status = 'not-applicable-preserve';
      entry.rationale = 'Existing usable top-level text is preserved verbatim; no replacement is proposed.';
      entry.existingTextApprovedMatches = candidates.filter(candidate =>
        candidate.documentId === targetDocumentId && candidate.originalPassageText === own.data.text);
      return entry;
    }
    entry.eligibleApprovedPassages = candidates;
    const selection = selections[key];
    if (!selection) {
      if (candidates.length) throw new Error('eligible-key-without-editorial-selection');
      entry.outcome = 'uncovered';
      entry.approval.status = 'blocked-no-approved-source';
      entry.rationale = !own && !sibling
        ? 'Neither the own motif document nor the exact word sibling exists. No permitted approved text is available; founder copy or separately approved content is required.'
        : 'No nonempty approved passage exists in the own motif document or exact word sibling. Drafts and other motifs cannot be used.';
      return entry;
    }
    const source = docs.get(selection.documentId);
    const passage = source?.data.passages?.[selection.passageIndex];
    if (![targetDocumentId, siblingDocumentId].includes(selection.documentId) ||
        source.data.key !== key || passage?.status !== 'approved' ||
        !nonempty(selection.text) || !passage.text.includes(selection.text)) {
      throw new Error('proposal-source-validation-failed');
    }
    const start = passage.text.indexOf(selection.text);
    entry.outcome = 'propose-text';
    entry.proposedText = selection.text;
    entry.proposedTextSha256 = textHash(selection.text);
    entry.rationale = selection.rationale;
    entry.provenance = {
      collection: 'practitionerContent', documentId: source.id,
      documentKey: source.data.key, documentKeyType: source.data.keyType,
      sourceRelationship: source.id === targetDocumentId ? 'own-motif' : 'exact-word-sibling',
      passageIndex: selection.passageIndex, statusAtReview: passage.status,
      source: passage.source, locator: passage.locator ?? null,
      createdAt: passage.createdAt ?? null, originalPassageText: passage.text,
      documentSha256: hash(source.data), passageSha256: hash(passage),
      originalPassageTextSha256: textHash(passage.text),
      documentUpdateTime: source.updateTime, documentUpdateTimeExact: source.updateTimeExact,
      extraction: { type: selection.text === passage.text ? 'whole-passage' : 'exact-sentence',
        startUtf16: start, endUtf16Exclusive: start + selection.text.length },
      validation: { approvedStatusExact: true, exactSubstring: true, exactKeyMatch: true,
        permittedSourceDocument: true },
    };
    return entry;
  });
  const tally = outcome => entries.filter(entry => entry.outcome === outcome).length;
  const result = {
    schemaVersion: 1, purpose: 'founder-content-review-only',
    authorization: { remoteWritesAuthorized: false, founderApprovalRequired: true,
      engineChangeAuthorized: false, deploymentAuthorized: false, backfillAuthorized: false },
    project: snapshot.project, database: snapshot.database,
    generatedAt: new Date().toISOString(),
    readTimes: { practitionerContent: snapshot.contentReadTime, motifLexicon: snapshot.lexiconReadTime },
    sourceFingerprintAlgorithm: 'sha256 of UTF-8 JSON with recursively sorted object keys; arrays retain order; Firestore Timestamp JSON uses _seconds and _nanoseconds. Text fingerprints hash raw UTF-8 text.',
    snapshots: {
      contentDocumentCount: snapshot.content.length, lexiconDocumentCount: snapshot.lexicon.length,
      practitionerContentSha256: hash(snapshot.content.map(({ id, data }) => ({ id, data }))),
      motifLexiconSha256: hash(snapshot.lexicon.map(({ id, data }) => ({ id, data }))),
    },
    coverage: { currentKeys: entries.length, preserved: tally('preserve-existing'),
      proposed: tally('propose-text'), uncovered: tally('uncovered'),
      potentialCoveredAfterSeparateApproval: tally('preserve-existing') + tally('propose-text') },
    validation: { proposalsAllExactApprovedSubstrings: true, allCurrentKeysAccountedFor: true,
      preservedExistingTextsUnchanged: true, remoteCollectionsRead: ['practitionerContent', 'motifLexicon'],
      accountDataRead: false, remoteWritesPerformed: false },
    laterApprovalSafeWriteRequirements: [
      'This JSON is a proposal, not an executable patch or authorization. Obtain explicit founder approval for each proposedText.',
      'Re-read the current lexicon and each target/source document before any later write. Compare exact update-time seconds/nanoseconds and canonical fingerprints; abort on any mismatch and review again.',
      'Re-check source passage status === approved, exact source key and allowed own/exact-sibling ID, full passage hash, UTF-16 extraction bounds, and exact proposed text hash.',
      'Preserve all six existing top-level texts and all passages, statuses, metadata, word documents, and lexicon records. Only separately approved proposed target text fields are eligible for later mutation.',
      'Uncovered entries carry no proposedText and must never be synthesized from draft passages, stems, synonyms, related motifs, teachings, or external copy.',
      'No engine changes, deploys or account recomputes are authorized here. Thread/word stem integration requires a separate later decision.',
    ],
    entries,
  };
  if (entries.length !== 20 || tally('preserve-existing') !== 6) throw new Error('unexpected-coverage-review-required');
  const e = escapeHtml;
  const candidateHtml = candidate => `<div class="context"><div class="meta">${e(candidate.documentId)} · passages[${candidate.passageIndex}] · ${e(candidate.status)} · ${e(candidate.source)} · locator: ${e(candidate.locator)}</div><p>${e(candidate.originalPassageText)}</p></div>`;
  const cards = entries.map(entry => {
    const proposed = entry.outcome === 'propose-text';
    const preserved = entry.outcome === 'preserve-existing';
    const title = proposed ? 'PROPOSED — approval pending' : preserved ? 'PRESERVE — no change' : 'UNCOVERED — no permitted approved source';
    return `<article id="key-${e(slug(entry.key))}" class="${proposed ? 'proposal' : preserved ? 'preserved' : 'uncovered'}">
      <h3>${e(entry.key)} <span>${title}</span></h3>
      <p class="meta">Target: practitionerContent/${e(entry.targetDocumentId)} · lexicon: ${e(entry.lexiconDocumentId)}</p>
      ${proposed || preserved ? `<blockquote>${e(proposed ? entry.proposedText : entry.targetBefore.topLevelText)}</blockquote>` : '<p><strong>No proposed text. Leave uncovered.</strong></p>'}
      <p>${e(entry.rationale)}</p>
      ${proposed ? `<p class="meta">Selected source: ${e(entry.provenance.documentId)} · passages[${entry.provenance.passageIndex}] (zero-based) · status: <strong>approved</strong> · source: ${e(entry.provenance.source)} · locator: ${e(entry.provenance.locator)}</p>
        <h4>Full original passage context — unchanged</h4><div class="context"><p>${e(entry.provenance.originalPassageText)}</p></div>
        <p class="meta">Exact substring validated; UTF-16 range [${entry.provenance.extraction.startUtf16}, ${entry.provenance.extraction.endUtf16Exclusive}). Passage SHA-256: <code>${entry.provenance.passageSha256}</code></p>
        <details><summary>All ${entry.eligibleApprovedPassages.length} eligible approved passages considered</summary>${entry.eligibleApprovedPassages.map(candidateHtml).join('')}</details>` : ''}
      ${preserved ? `<p class="meta">Existing text matches approved own passage${entry.existingTextApprovedMatches.map(candidate => ` [${candidate.passageIndex}]`).join(',')}; source: founder. Preserved verbatim.</p>` : ''}
      ${!proposed && !preserved ? `<p class="meta">${e(entry.targetDocumentId)}: ${entry.targetBefore.exists ? 'exists; no approved text' : 'missing'} · ${e(entry.siblingDocumentId)}: ${entry.siblingBefore.exists ? 'exists; no approved text' : 'missing'}</p>` : ''}
    </article>`;
  }).join('');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mineral — Motif text founder review</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f2ec;color:#243b35;font:17px/1.65 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:42px 24px 72px}h1{font-size:36px;line-height:1.2;letter-spacing:-1px}h2{margin-top:38px}h3{margin-top:0;font-size:25px}h3 span{display:block;font:12px/1.6 system-ui;letter-spacing:.07em;margin-top:6px}.eyebrow{font-size:12px;letter-spacing:.15em}.notice{background:#e5ebe2;border-left:4px solid #52715b;padding:18px 22px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.stats div{background:#fff;padding:16px;border:1px solid #d5dbd1}.stats strong{display:block;font-size:32px}.stats span{font-size:13px}.meta{font-size:13px;color:#53665c;overflow-wrap:anywhere}article{margin:20px 0;padding:25px;background:#fff;border:1px solid #d5dbd1;border-left:5px solid #7c9284}article.proposal{border-left-color:#345f46}article.uncovered{border-left-color:#a78960}blockquote{margin:22px 0;font:23px/1.55 Georgia,serif;color:#213e31}h4{font-size:15px;margin-bottom:10px}.context{background:#f4f5ef;padding:12px 18px;margin:12px 0}.context p{margin:7px 0;font-size:16px}summary{cursor:pointer;font-size:14px}a{color:#345f46}code{font-size:12px;overflow-wrap:anywhere}nav{display:flex;gap:10px 16px;flex-wrap:wrap}nav a{font-size:14px}@media(max-width:600px){main{padding:24px 16px}h1{font-size:29px}.stats{grid-template-columns:repeat(2,1fr)}article{padding:20px}blockquote{font-size:21px}}@media print{body{background:white}main{max-width:none;padding:0}article{break-inside:avoid}details{display:none}}
</style></head><body><main>
<div class="eyebrow">MINERAL · FOUNDER CONTENT REVIEW · READ ONLY</div>
<h1>Motif lines, without invention.</h1>
<div class="notice"><strong>Awaiting Bryn’s approval.</strong> This is a proposal only. No Firestore mutations, approvals, engine changes, deploys, backfills, account reads, or git operations were performed. Only local report artifacts were created.</div>
<div class="stats"><div><strong>${entries.length}</strong><span>current lexicon keys</span></div><div><strong>${tally('preserve-existing')}</strong><span>existing texts preserved</span></div><div><strong>${tally('propose-text')}</strong><span>approved-source proposals</span></div><div><strong>${tally('uncovered')}</strong><span>explicitly uncovered</span></div></div>
<p>After separate approval and text writes, potential motif coverage is <strong>8/20</strong>, not 20/20. Twelve keys have neither an own motif document nor an exact word sibling. No replacement wording is supplied for them.</p>
<p class="meta">Live project: ${e(snapshot.project)} · default database · practitionerContent read: ${e(snapshot.contentReadTime)} · motifLexicon read: ${e(snapshot.lexiconReadTime)} · ${snapshot.content.length} content documents. Passage indices are zero-based.</p>
<h2>What changed since the earlier report?</h2>
<p>The current keys are verified live, not inferred from the prior report. The key set remains the same. Unlike that older snapshot, motif_body and word_body passages are now <strong>approved</strong>; word_balance is also now approved. Passage status is not authorization to select or write top-level text. Six existing usable texts remain unchanged.</p>
<p>Selection is confined to approved passages from the same key’s own motif document or exact word sibling. Each proposed line is one complete sentence copied verbatim, including capitalization and punctuation. All eligible alternatives for those two keys are included below. Generated source text remains identified as generated; historical and tradition claims have not been independently verified.</p>
<nav>${entries.map(entry => `<a href="#key-${e(slug(entry.key))}">${e(entry.key)}</a>`).join('')}</nav>
<h2>Proposed additions</h2>${entries.filter(entry => entry.outcome === 'propose-text').map(entry => cards.slice(cards.indexOf(`<article id="key-${slug(entry.key)}"`), cards.indexOf('</article>', cards.indexOf(`<article id="key-${slug(entry.key)}"`)) + 10)).join('')}
<h2>Preserve these six existing texts</h2>${entries.filter(entry => entry.outcome === 'preserve-existing').map(entry => cards.slice(cards.indexOf(`<article id="key-${slug(entry.key)}"`), cards.indexOf('</article>', cards.indexOf(`<article id="key-${slug(entry.key)}"`)) + 10)).join('')}
<h2>Uncovered keys — founder action needed</h2>${entries.filter(entry => entry.outcome === 'uncovered').map(entry => cards.slice(cards.indexOf(`<article id="key-${slug(entry.key)}"`), cards.indexOf('</article>', cards.indexOf(`<article id="key-${slug(entry.key)}"`)) + 10)).join('')}
<h2>Approval and safety boundary</h2><ul>${result.laterApprovalSafeWriteRequirements.map(line => `<li>${e(line)}</li>`).join('')}</ul>
<p>No signed-in UI, deployed parity, account-specific eligibility, or device rendering was checked. No account data was accessed. The content-only proposals do not require or authorize a word-stem engine change.</p>
<h2>Snapshot provenance</h2><p class="meta">Canonical SHA-256, practitionerContent: <code>${result.snapshots.practitionerContentSha256}</code><br>motifLexicon: <code>${result.snapshots.motifLexiconSha256}</code></p>
<p class="meta">Machine-readable companion: motif-top-level-text-founder-review.json. Includes all 20 key outcomes, target preconditions, exact source provenance, complete proposed-source passages, approved status evidence, fingerprints, extraction bounds, and pending approval fields. The earlier report used a different serialization order; its digest is not directly comparable.</p>
</main></body></html>`;
  fs.writeFileSync(`${OUTPUT_BASE}.json`, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(`${OUTPUT_BASE}.html`, html);
  console.log(JSON.stringify({ coverage: result.coverage, validation: result.validation,
    outputs: [`${OUTPUT_BASE}.html`, `${OUTPUT_BASE}.json`] }, null, 2));
}

async function snapshot() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('missing-service-account');
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (account.project_id !== PROJECT) throw new Error('project-mismatch');
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('emulator-refused');
  admin.initializeApp({ credential: admin.credential.cert(account), projectId: PROJECT });
  const db = admin.firestore();
  const [content, lexicon] = await Promise.all([
    db.collection('practitionerContent').get(),
    db.collection('motifLexicon').get(),
  ]);
  const records = snap => snap.docs.map(doc => ({
    id: doc.id, updateTime: doc.updateTime.toDate().toISOString(),
    updateTimeExact: { seconds: doc.updateTime.seconds, nanoseconds: doc.updateTime.nanoseconds },
    data: doc.data(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const result = {
    project: PROJECT, database: '(default)', generatedAt: new Date().toISOString(),
    contentReadTime: content.readTime.toDate().toISOString(),
    lexiconReadTime: lexicon.readTime.toDate().toISOString(),
    content: records(content), lexicon: records(lexicon),
  };
  fs.writeFileSync(SNAPSHOT, JSON.stringify(result, null, 2));
  console.log(`Read-only snapshot: ${result.content.length} content docs, ${result.lexicon.length} lexicon docs.`);
  const docs = new Map(result.content.map(record => [record.id, record]));
  for (const entry of result.lexicon) {
    const key = entry.data.key;
    if (!nonempty(key)) throw new Error('invalid-lexicon-key');
    const id = `${entry.data.keyType}_${slug(key)}`;
    const own = docs.get(id);
    const sibling = docs.get(`word_${slug(key)}`);
    console.log(JSON.stringify({
      key, lexiconId: entry.id, keyType: entry.data.keyType,
      own: own ? { id, data: own.data } : null,
      sibling: sibling ? { id: sibling.id, data: sibling.data } : null,
    }));
  }
}

Promise.resolve().then(() => process.argv.includes('--report') ? report() : snapshot()).catch(() => {
  // SDK error messages can contain credential-bearing request context.
  console.error('Read-only content review failed; no success claimed and no remote writes performed.');
  process.exitCode = 1;
}).finally(async () => {
  await Promise.all(admin.apps.map(app => app.delete()));
});