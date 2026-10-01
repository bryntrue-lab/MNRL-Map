#!/usr/bin/env node
'use strict';

// Build 14 Part 3 REVIEW ONLY. Two collection GETs, no remote writes.
// This deliberately does not import the seed, queue, or pattern-engine modules.
// Run: node seed-content/MNRL-seed-content/seed/review-practitioner-content.js
const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
const { randomInt, createHash } = require('node:crypto');

const PROJECT = 'mineral-resonance';
const OUTPUT = path.resolve(__dirname, '../../../attached_assets/build14-practitioner-content-review.md');
const TEACHING_IDS = [
  'teaching_resistance', 'teaching_threads', 'teaching_motifs',
  'teaching_conditions', 'teaching_consciousness', 'teaching_map',
];
const VALID_TYPES = new Set(['motif', 'resistance', 'condition']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const cell = value => String(value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const lookupId = (type, key) =>
  `${type}_${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

function teachingIssues(data) {
  if (!data) return ['document missing'];
  const issues = [];
  if (data.kind !== 'teaching') issues.push('kind is not teaching');
  if (!nonempty(data.heldLine)) issues.push('heldLine missing/empty/non-string');
  if (!Array.isArray(data.paragraphs) || !data.paragraphs.length ||
      data.paragraphs.some(p => typeof p !== 'string')) {
    issues.push('paragraphs is not a nonempty string[]');
  }
  if (data.closingParagraphIndex !== undefined &&
      (!Number.isInteger(data.closingParagraphIndex) ||
       data.closingParagraphIndex < 0 ||
       data.closingParagraphIndex >= (data.paragraphs?.length ?? 0))) {
    issues.push('closingParagraphIndex outside paragraph array');
  }
  return issues;
}

function offeringIssues(id, data) {
  const issues = [];
  if (!nonempty(data.key)) issues.push('key missing/invalid');
  if (!VALID_TYPES.has(data.keyType)) issues.push(`unsupported keyType ${data.keyType ?? '(missing)'}`);
  if (!nonempty(data.text)) issues.push('top-level text missing/empty');
  if (nonempty(data.key) && id !== lookupId(data.keyType, data.key)) {
    issues.push('ID differs from engine slug convention');
  }
  if (data.kind !== 'offering') issues.push('kind not offering: client read rule will reject');
  return issues;
}

function passageSection(entry, number, docs, lexiconIds) {
  const data = docs.get(entry.id);
  const issues = offeringIssues(entry.id, data);
  return [
    `### ${number}. ${entry.id} · passage index ${entry.index} (zero-based)`,
    '',
    `Key: **${cell(data.key)}** · keyType: **${cell(data.keyType)}** · status: **${cell(entry.passage.status)}** · source: **${cell(entry.passage.source)}**`,
    '',
    `Locator: ${entry.passage.locator == null ? '(none)' : entry.passage.locator}`,
    '',
    typeof entry.passage.text === 'string' ? entry.passage.text : '**INVALID: passage text is not a string.**',
    '',
    `Engine readiness: ${issues.length ? issues.join('; ') : 'valid keyed top-level shape'}. Current lexicon lookup: ${lexiconIds.has(entry.id) ? 'yes' : 'no'}.`,
    '',
  ].join('\n');
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw Object.assign(new Error(), { code: 'missing-FIREBASE_SERVICE_ACCOUNT' });
  }
  let account;
  try {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw Object.assign(new Error(), { code: 'invalid-service-account-JSON' });
  }
  if (account.project_id !== PROJECT) {
    throw Object.assign(new Error(), { code: 'service-account-project-mismatch' });
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw Object.assign(new Error(), { code: 'emulator-configured-live-review-refused' });
  }
  admin.initializeApp({ credential: admin.credential.cert(account), projectId: PROJECT });
  const db = admin.firestore();
  const [contentSnapshot, lexiconSnapshot] = await Promise.all([
    db.collection('practitionerContent').get(),
    db.collection('motifLexicon').get(),
  ]);
  const records = contentSnapshot.docs
    .map(doc => ({ id: doc.id, data: doc.data() }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const docs = new Map(records.map(entry => [entry.id, entry.data]));
  const lexicon = lexiconSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  const lexiconIds = new Set(lexicon.filter(entry => nonempty(entry.data.key))
    .map(entry => lookupId(entry.data.keyType, entry.data.key)));
  const offerings = records.filter(entry => entry.data.kind === 'offering' ||
    Array.isArray(entry.data.passages));
  const teachings = records.filter(entry => entry.data.kind === 'teaching' ||
    entry.id.startsWith('teaching_'));
  const counts = new Map();
  const drafts = [];
  for (const entry of offerings) {
    const type = entry.data.keyType ?? '(missing)';
    const tally = counts.get(type) ?? { docs: 0, drafts: 0, approved: 0, topText: 0 };
    tally.docs++;
    if (nonempty(entry.data.text)) tally.topText++;
    (Array.isArray(entry.data.passages) ? entry.data.passages : []).forEach((passage, index) => {
      if (passage?.status === 'draft') {
        tally.drafts++;
        drafts.push({ id: entry.id, index, passage });
      }
      if (passage?.status === 'approved') tally.approved++;
    });
    counts.set(type, tally);
  }
  // Unbiased Fisher–Yates shuffle of the entire live draft-passage population.
  const shuffled = [...drafts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, Math.min(20, shuffled.length));
  const forbiddenTermHits = sample.flatMap(entry => {
    const text = typeof entry.passage.text === 'string' ? entry.passage.text : '';
    const terms = [...new Set(text.match(/\b(theme|insight|meaning|journey|progress|streak|journal|entry|log)\b/gi) ?? [])];
    return terms.length ? [`${entry.id}[${entry.index}]: ${terms.join(', ')}`] : [];
  });
  const sampled = new Set(sample.map(entry => `${entry.id}:${entry.index}`));
  // Supplemental, not part of the random sample: all currently matchable drafts.
  const supplemental = drafts.filter(entry => lexiconIds.has(entry.id) &&
    !sampled.has(`${entry.id}:${entry.index}`));
  const totalApproved = [...counts.values()].reduce((n, tally) => n + tally.approved, 0);
  const missingLookups = [...lexiconIds].filter(id => !docs.has(id)).sort();
  const readableLookups = [...lexiconIds].filter(id => nonempty(docs.get(id)?.text)).sort();
  const matchedNoText = [...lexiconIds].filter(id => docs.has(id) && !nonempty(docs.get(id)?.text)).sort();
  const teachingFailures = TEACHING_IDS.filter(id => teachingIssues(docs.get(id)).length);
  const fingerprint = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  const lines = [
    '# Build 14 · practitioner content · REVIEW ONLY',
    '',
    '**Awaiting Bryn’s review. Nothing has been approved, published, seeded, purged, or backfilled.**',
    '',
    `Live project: **${PROJECT}**, default Firestore database. Collection read time: **${contentSnapshot.readTime.toDate().toISOString()}**.`,
    `Report generated: ${new Date().toISOString()}. Read-only Admin SDK access succeeded using the existing secret; credentials are neither displayed nor saved.`,
    '',
    'Only practitionerContent and motifLexicon were read. No users, notes, profiles, account identities, or existing user-pattern data were accessed. The utility writes only this local report.',
    '',
    `Content snapshot SHA-256 (all content records, sorted by ID): \`${fingerprint}\`. This identifies the reviewed snapshot, not authorization to change it.`,
    '',
    '## 1. Live inventory and key findings',
    '',
    `- practitionerContent: **${records.length} documents**, including **${teachings.length} teachings** and **${offerings.length} offering documents**.`,
    `- **${drafts.length} actual draft passages** across **${new Set(drafts.map(entry => entry.id)).size} documents**; **${totalApproved} already-approved passages**. These are passage-level statuses, not a document-wide approved toggle.`,
    `- Required teaching IDs: **${TEACHING_IDS.length - teachingFailures.length}/${TEACHING_IDS.length} pass shape validation**. Teachings are already stored in practitionerContent; the checked client does not gate them on approved.`,
    `- Current motifLexicon: **${lexicon.length} records**. **${readableLookups.length}/${lexiconIds.size} lookup IDs have usable top-level text**, **${matchedNoText.length} exist without text**, and **${missingLookups.length} have no practitionerContent document**.`,
    '- Therefore the brief’s “nothing was ever published” premise does not match this live snapshot. Admin reads do not prove what a signed-in device can currently render; deployment, auth, stale mounts, and user-pattern state remain unverified.',
    '',
    '| keyType | Offering docs | Draft passages | Approved passages | Docs with top-level text |',
    '|---|---:|---:|---:|---:|',
    ...[...counts.entries()].sort().map(([type, tally]) =>
      `| ${cell(type)} | ${tally.docs} | ${tally.drafts} | ${tally.approved} | ${tally.topText} |`),
    '',
    '### Publication hazards — for decision after review, not actions taken',
    '',
    '- **word is not an offering keyType supported by the client schema.** The queue derives word keys from thread patterns, but the current pattern engine only requests keyed offerings for motif/resistance lexicon hits. Approving word_* passage statuses alone cannot produce PatternDoc.offerings or a Guide hero offering. Do not silently relabel word keys as motifs: that changes semantics and still requires actual lexicon coverage.',
    '- **Passage approval and hero text are separate paths.** FieldPassageSheet filters passages[].status === approved. The engine reads only the document’s top-level text and does not inspect passage approvals, kind, or keyType before copying it. A status flip cannot populate missing text; an unsafe top-level text copy could expose unreviewed content even with draft passage statuses.',
    '- **kind: offering is required for client read authorization** under the checked-in Firestore rules, even though the brief’s minimal keyed shape omits kind.',
    '- The source queue is currently paused (an unconditional early return). Its inactive generation path produces three generated draft passages per key but does not populate top-level text.',
    '- Current lexicon contains no resistance or condition keyTypes. Conditions findings use a separate hardcoded approved-phrasing mechanism, not condition_* keyed offerings; the current rebuild does not load condition offerings.',
    '',
    `Current engine-addressable docs with text: ${readableLookups.map(id => `\`${id}\``).join(', ') || '(none)'}.`,
    '',
    `Existing lookup docs lacking top-level text: ${matchedNoText.map(id => `\`${id}\``).join(', ') || '(none)'}.`,
    '',
    `Missing current lexicon lookups: ${missingLookups.map(id => `\`${id}\``).join(', ') || '(none)'}.`,
    '',
    '### Content-review flags in the random sample',
    '',
    `Exact-word hits against the checked-in passage prompt’s forbidden vocabulary: ${forbiddenTermHits.length ? forbiddenTermHits.map(hit => `\`${hit}\``).join('; ') : '(none detected by this narrow check)'}. This is a mechanical copy check, not an approval or comprehensive editorial assessment.`,
    '',
    'Tradition/historical claims and locators have not been independently source-checked. Broad attributions such as “Indigenous traditions” or “the ancient Greeks” should receive Bryn’s scholarly review rather than be treated as verified citations. Original texts below are left unchanged.',
    '',
    '## 2. ALL live teaching heldLines',
    '',
    'Verbatim from Firestore, including teachings already present (not mislabeled as drafts). Required IDs and each shape were checked. Extra fields such as key/keyType and the map glossary are additive.',
    '',
    '| Document ID | heldLine (verbatim) | Paragraphs | closingParagraphIndex | Validation |',
    '|---|---|---:|---|---|',
    ...teachings.map(({ id, data }) => {
      const issues = teachingIssues(data);
      return `| ${cell(id)} | ${cell(data.heldLine)} | ${Array.isArray(data.paragraphs) ? data.paragraphs.length : 'invalid'} | ${cell(data.closingParagraphIndex)} | ${issues.length ? cell(issues.join('; ')) : 'PASS'} |`;
    }),
    ...TEACHING_IDS.filter(id => !docs.has(id)).map(id => `| ${id} | MISSING | — | — | FAIL |`),
    '',
    '## 3. Random sample of actual offering drafts',
    '',
    `**${sample.length} passages**, selected without replacement from all **${drafts.length} live passages with status draft** using Node crypto.randomInt and a Fisher–Yates shuffle. The sampling unit is a passage, not a key/document; more than one passage from a document is possible. No seeded, historical-export, approved, or invented text substitutes were used. Original array indices are preserved below.`,
    '',
    ...sample.map((entry, index) => passageSection(entry, index + 1, docs, lexiconIds)),
    '## 4. Supplemental engine-addressable draft texts',
    '',
    'Because the population is mostly word_* content, these are all remaining drafts whose document IDs are actually requested by the current lexicon. This targeted supplement is explicitly NOT part of the random sample.',
    '',
    ...(supplemental.length ? supplemental.map((entry, index) =>
      passageSection(entry, `S${index + 1}`, docs, lexiconIds)) : ['No additional matchable drafts outside the random sample.', '']),
    '## 5. Exact read/write contract from repository code',
    '',
    'This section describes existing code; no write path was invoked.',
    '',
    '- Teachings: IDs teaching_resistance, teaching_threads, teaching_motifs, teaching_conditions, teaching_consciousness, teaching_map; shape { kind: "teaching", heldLine: string, paragraphs: string[], closingParagraphIndex?: number }. Optional index is zero-based and must be in range.',
    '- Guide reads teaching_{lens.id} once per mount and accepts heldLine only for kind teaching; errors silently become empty strings. Lens routes read the same IDs. Origin reads teaching_map.',
    '- Offering lookup ID: keyType + "_" + key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""). Example: motif + "Water" → motif_water; resistance + "Self Doubt" → resistance_self-doubt. Original key (not slug) is retained in PatternDoc.offerings.',
    '- Required keyed client payload is { key: string, keyType: "motif" | "resistance" | "condition", text: string }; add kind: "offering" for client access under current rules. Passage-sheet content additionally needs passages[] entries { text, locator: string|null, status: "approved"|"draft", source: "founder"|"generated", createdAt: Timestamp }.',
    '- Engine loadOfferings / offeringsFromSnapshots read top-level text. rebuildPatternsForUser writes { [originalKey]: { key: originalKey, text } } to users/{uid}/patterns/resistance.offerings for resistance hits and users/{uid}/patterns/motif.offerings otherwise. Guide’s hero reads patterns[hero.type].offerings[hero.key]. It separately watches motif_{hero.key} for approved passage-sheet content.',
    '- The actual queue stores { key, keyType: "motif"|"word", kind: "offering", passages: [three drafts] } at {keyType}_{slug}; it omits text. Its slug replacement does not trim edge hyphens, unlike the engine, although the queue’s current single-word alphabetic filter avoids that difference.',
    '- The seed migration maintains both passages and a compatibility text field. Rerunning the seed is NOT a safe review operation: it performs writes and marks seeded passages approved. No seed was run.',
    '- backfillPatterns callable is authenticated and self-only: it rebuilds request.auth.uid. It does not accept an arbitrary target UID for founder/tester/demo bulk work. No callable, rebuild, generation lease, or backfill was run.',
    '',
    '### Source anchors',
    '',
    '- functions/fieldQueue.js:10–12, 18–40, 44–58, 144–182, 198–212 — IDs, passage drafts, word candidates, storage, paused scheduler.',
    '- seed-content/MNRL-seed-content/mineral-content/practitioner-content/passage-prompt.json — forbidden vocabulary used for the narrow sample check.',
    '- functions/patternEngine.js:781–811, 855–885, 1079–1111, 1146–1151 — exact offering lookup, hits, live rebuild, PatternDoc.offerings assignment.',
    '- functions/index.js:367–381 — actual backfillPatterns callable.',
    '- artifacts/mineral/types/firestore.ts:211–215, 259–276 — PatternDoc and practitioner content types.',
    '- artifacts/mineral/app/(tabs)/guide.tsx:267–290, 353–372 — teaching subtitles, hero offering, approved-passage watcher.',
    '- artifacts/mineral/app/lens/[lens].tsx:123–141, 239–241 — teaching read and motif keyed-content read.',
    '- artifacts/mineral/app/(tabs)/origin.tsx:420 — teaching_map read.',
    '- artifacts/mineral/lib/fieldPassages.ts:4–13 — approval filter.',
    '- firestore.rules:13–18 — kind-based authenticated reads; client writes denied.',
    '- seed-content/MNRL-seed-content/seed/seed-content.js:174–213, 392–445 — offering migration and explicit teaching IDs.',
    '',
    '## 6. Complete offering readiness inventory',
    '',
    'PASS here means the keyed shape and kind are usable, not that Bryn has approved anything in this session. “Lexicon lookup” means a key can be requested if matched in a note, not proof it appears in any account’s current field. All counts refer to this snapshot.',
    '',
    '| Document | keyType | Draft / approved passages | Top-level text | Lexicon lookup | Shape issues |',
    '|---|---|---:|---|---|---|',
    ...offerings.map(({ id, data }) => {
      const passages = Array.isArray(data.passages) ? data.passages : [];
      const issues = offeringIssues(id, data);
      return `| ${cell(id)} | ${cell(data.keyType)} | ${passages.filter(p => p?.status === 'draft').length} / ${passages.filter(p => p?.status === 'approved').length} | ${nonempty(data.text) ? 'yes' : 'no'} | ${lexiconIds.has(id) ? 'yes' : 'no'} | ${issues.length ? cell(issues.join('; ')) : 'PASS'} |`;
    }),
    '',
    '## 7. Review gate and limits',
    '',
    '**Stop here for Bryn.** This report is not approval. No content edits, status flips, document moves, publications, account changes, recomputes, deployments, or git branch/commit operations were performed.',
    '',
    'Before any later publication, obtain explicit approval and resolve word-key semantics, missing text, and lexicon gaps. Preserve approved founder passages and agree which reviewed passage becomes compatibility text. Re-read content to catch changes since this fingerprint. Account-specific recomputes require separately authorized authenticated self-callables or a properly scoped administrative path.',
    '',
    'Not verified: deployed functions/rules parity, signed-in Guide rendering, founder/tester/demo PatternDoc state, account-specific hero eligibility. Admin collection reads bypass client rules. No UI authentication bypass or user-account read was attempted.',
    '',
    'Re-run utility (read-only remote access; replaces this local report with a fresh snapshot/sample):',
    '',
    '    node seed-content/MNRL-seed-content/seed/review-practitioner-content.js',
    '',
  ];
  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');
  console.log(`Review-only report created: ${path.relative(process.cwd(), OUTPUT)}`);
  console.log(`${records.length} content docs; ${teachings.length} teachings; ${drafts.length} draft passages; ${sample.length} random samples. No remote writes.`);
}

main().catch(error => {
  // Do not log credential-bearing SDK errors, stacks, or request payloads.
  const code = String(error.code ?? 'unknown-error').replace(/[^a-zA-Z0-9_-]/g, '');
  console.error(`Read-only review failed (code: ${code}). No report success claimed.`);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.all(admin.apps.map(app => app.delete()));
});