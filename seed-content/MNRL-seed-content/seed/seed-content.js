#!/usr/bin/env node
/**
 * Mineral — Content Seed Script
 *
 * Reads structured content from ../mineral-content/ and writes it to Firestore
 * and Cloud Storage using the Firebase Admin SDK. This establishes the
 * `encounters` and `practitionerContent` collections in one pass — Firestore
 * is schemaless at the DB level, so there is no separate migration step.
 *
 * SAFE TO RE-RUN. Documents are keyed by slug (or {keyType}_{key} for
 * practitioner content). Each run:
 *   - Validates every JSON before touching Firebase; a bad file aborts THAT
 *     file with a clear message and moves on. Nothing partial is written.
 *   - Uploads matching audio to encounters/{slug}/audio.mp3 in Storage.
 *   - Writes/overwrites the encounter document with `set()` — updates in
 *     place, never duplicates.
 *   - Reports created / updated / skipped / failed per item.
 *
 * Prerequisites:
 *   - Node 18+
 *   - `npm install firebase-admin`
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing at a service-account
 *     JSON with Firestore + Storage write access
 *   - FIREBASE_STORAGE_BUCKET env var (typically <projectId>.appspot.com,
 *     or the new default <projectId>.firebasestorage.app)
 *
 * Content folder layout (relative to this script's parent parent):
 *   mineral-content/
 *   ├── encounters/{slug}.json     (Encounter shape from schema v1.6)
 *   ├── practitioner-content/
 *   │   └── offerings.json         (array of { key, keyType, text })
 *   └── audio/{audioFile}.mp3      (referenced by each encounter's audioFile)
 *
 * The Admin SDK bypasses Firestore security rules. This is by design —
 * `encounters` and `practitionerContent` are locked to `write: if false`
 * for clients; seeding happens server-side with the service account.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CONTENT_ROOT = path.resolve(__dirname, '..', 'mineral-content');
const ENCOUNTERS_DIR = path.join(CONTENT_ROOT, 'encounters');
const AUDIO_DIR = path.join(CONTENT_ROOT, 'audio');
const OFFERINGS_FILE = path.join(CONTENT_ROOT, 'practitioner-content', 'offerings.json');
const TEACHINGS_FILE = path.join(CONTENT_ROOT, 'practitioner-content', 'teachings.json');
const MOTIF_LEXICON_FILE = path.join(CONTENT_ROOT, 'motif-lexicon', 'lexicon.json');

const VALID_PHASES = new Set(['signal', 'field', 'friction', 'voice']);
const VALID_BLOCK_TYPES = new Set(['listen', 'practice', 'reflection', 'integration', 'carry']);
const VALID_KEY_TYPES = new Set(['motif', 'resistance', 'condition']);

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

function initFirebase() {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Replit path: JSON is in the env var as a string
    try {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } catch (e) {
      console.error('ERROR: FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local path: env var points at a file
    credential = admin.credential.applicationDefault();
  } else {
    console.error('ERROR: set FIREBASE_SERVICE_ACCOUNT (Replit) or GOOGLE_APPLICATION_CREDENTIALS (local).');
    process.exit(1);
  }
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    console.error('ERROR: FIREBASE_STORAGE_BUCKET must be set.');
    process.exit(1);
  }
  admin.initializeApp({ credential, storageBucket: bucket });
  
  return { db: admin.firestore(), bucket: admin.storage().bucket() };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────

function validateEncounter(slug, doc) {
  const errors = [];
  const required = ['title', 'subtitle', 'phase', 'order', 'minTurn', 'audioPath', 'blocks'];
  for (const field of required) {
    if (!(field in doc)) errors.push(`missing required field: ${field}`);
  }

  if (doc.phase && !VALID_PHASES.has(doc.phase)) {
    errors.push(`invalid phase "${doc.phase}" (must be one of: ${[...VALID_PHASES].join(', ')})`);
  }
  if (doc.order !== undefined && (!Number.isInteger(doc.order) || doc.order < 1)) {
    errors.push(`order must be a positive integer (got ${doc.order})`);
  }
  if (doc.minTurn !== undefined && (!Number.isInteger(doc.minTurn) || doc.minTurn < 1)) {
    errors.push(`minTurn must be a positive integer (got ${doc.minTurn})`);
  }

  if (Array.isArray(doc.blocks)) {
    let crystallizingCount = 0;
    const seenPromptIds = new Set();
    doc.blocks.forEach((block, i) => {
      if (!VALID_BLOCK_TYPES.has(block.type)) {
        errors.push(`block[${i}] has invalid type "${block.type}"`);
      }
      (block.prompts || []).forEach((p, j) => {
        if (!p.id) errors.push(`block[${i}].prompts[${j}] missing id`);
        if (!p.text) errors.push(`block[${i}].prompts[${j}] missing text`);
        if (p.id && seenPromptIds.has(p.id)) errors.push(`duplicate prompt id "${p.id}"`);
        if (p.id) seenPromptIds.add(p.id);
        if (p.crystallizing) crystallizingCount++;
      });
    });
    if (crystallizingCount > 1) {
      errors.push(`blocks[] contains ${crystallizingCount} crystallizing prompts (max 1)`);
    }
  } else if (doc.blocks !== undefined) {
    errors.push('blocks must be an array');
  }

  if (Array.isArray(doc.deepDive)) {
    let dvCrystallizing = 0;
    doc.deepDive.forEach((block, i) => {
      if (!VALID_BLOCK_TYPES.has(block.type)) {
        errors.push(`deepDive[${i}] has invalid type "${block.type}"`);
      }
      (block.prompts || []).forEach(p => { if (p.crystallizing) dvCrystallizing++; });
    });
    if (dvCrystallizing > 1) errors.push(`deepDive contains ${dvCrystallizing} crystallizing prompts (max 1)`);
  }

  return errors;
}

function validateOffering(entry, i) {
  const errors = [];
  if (!entry.key) errors.push(`offerings[${i}]: missing key`);
  if (!entry.keyType) errors.push(`offerings[${i}]: missing keyType`);
  if (entry.keyType && !VALID_KEY_TYPES.has(entry.keyType)) {
    errors.push(`offerings[${i}]: invalid keyType "${entry.keyType}"`);
  }
  if (!entry.text) errors.push(`offerings[${i}]: missing text`);
  return errors;
}

// ─────────────────────────────────────────────────────────────
// AUDIO UPLOAD
// ─────────────────────────────────────────────────────────────

async function uploadAudio(bucket, slug, audioFile) {
  if (!audioFile) return { uploaded: false, reason: 'no audioFile field' };
  const localPath = path.join(AUDIO_DIR, audioFile);
  if (!fs.existsSync(localPath)) {
    return { uploaded: false, reason: `local audio not found: ${audioFile}` };
  }
  const destination = `encounters/${slug}/audio.mp3`;
  await bucket.upload(localPath, {
    destination,
    metadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=3600' },
  });
  return { uploaded: true, destination };
}

// ─────────────────────────────────────────────────────────────
// SEEDING — ENCOUNTERS
// ─────────────────────────────────────────────────────────────

async function seedEncounters(db, bucket) {
  console.log('\n─── Encounters ───────────────────────────────');
  if (!fs.existsSync(ENCOUNTERS_DIR)) {
    console.log('  no encounters directory; skipping.');
    return;
  }

  const files = fs.readdirSync(ENCOUNTERS_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('  no encounter JSON files found.');
    return;
  }

  const seenOrders = new Map(); // phase → Set of orders (catches collisions)
  let created = 0, updated = 0, failed = 0;

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const filePath = path.join(ENCOUNTERS_DIR, file);
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.log(`  ✗ ${slug}: JSON parse error — ${e.message}`);
      failed++;
      continue;
    }

    const errors = validateEncounter(slug, doc);
    if (errors.length) {
      console.log(`  ✗ ${slug}: validation failed`);
      errors.forEach(e => console.log(`      · ${e}`));
      failed++;
      continue;
    }

    // Order-collision check (across files in this run)
    if (!seenOrders.has(doc.phase)) seenOrders.set(doc.phase, new Map());
    const phaseOrders = seenOrders.get(doc.phase);
    if (phaseOrders.has(doc.order)) {
      console.log(`  ✗ ${slug}: order ${doc.order} in phase "${doc.phase}" collides with ${phaseOrders.get(doc.order)}`);
      failed++;
      continue;
    }
    phaseOrders.set(doc.order, slug);

    // Audio upload
    let audioResult = { uploaded: false };
    try {
      audioResult = await uploadAudio(bucket, slug, doc.audioFile);
    } catch (e) {
      console.log(`  ✗ ${slug}: audio upload failed — ${e.message}`);
      failed++;
      continue;
    }

    // Prepare the Firestore document — strip local-only fields
    const { audioFile, ...docToWrite } = doc;

    // Idempotent write: exists → update, new → create
    const ref = db.collection('encounters').doc(slug);
    const existing = await ref.get();
    try {
      await ref.set(docToWrite); // full overwrite of the doc
      if (existing.exists) {
        console.log(`  ↻ ${slug} (order ${doc.order}, ${doc.phase}) — updated${audioResult.uploaded ? ' + audio' : ''}${!audioResult.uploaded ? ` [audio: ${audioResult.reason}]` : ''}`);
        updated++;
      } else {
        console.log(`  ✓ ${slug} (order ${doc.order}, ${doc.phase}) — created${audioResult.uploaded ? ' + audio' : ''}${!audioResult.uploaded ? ` [audio: ${audioResult.reason}]` : ''}`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${slug}: Firestore write failed — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  encounters — created ${created}, updated ${updated}, failed ${failed}`);
}

// ─────────────────────────────────────────────────────────────
// SEEDING — PRACTITIONER CONTENT
// ─────────────────────────────────────────────────────────────

async function seedPractitionerContent(db) {
  console.log('\n─── Practitioner content ─────────────────────');
  if (!fs.existsSync(OFFERINGS_FILE)) {
    console.log('  no offerings.json; skipping.');
    return;
  }

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(OFFERINGS_FILE, 'utf8'));
  } catch (e) {
    console.log(`  ✗ offerings.json parse error — ${e.message}`);
    return;
  }
  if (!Array.isArray(entries)) {
    console.log('  ✗ offerings.json must be an array');
    return;
  }

  let created = 0, updated = 0, failed = 0;
  const seenIds = new Set();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const errors = validateOffering(entry, i);
    if (errors.length) {
      errors.forEach(e => console.log(`  ✗ ${e}`));
      failed++;
      continue;
    }

    // Deterministic doc id — idempotent on repeat runs
    const docId = `${entry.keyType}_${entry.key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    if (seenIds.has(docId)) {
      console.log(`  ✗ offerings[${i}]: duplicate id "${docId}" (key + keyType collision)`);
      failed++;
      continue;
    }
    seenIds.add(docId);

    const ref = db.collection('practitionerContent').doc(docId);
    const existing = await ref.get();
    try {
      await ref.set(entry);
      if (existing.exists) {
        console.log(`  ↻ ${docId} — updated`);
        updated++;
      } else {
        console.log(`  ✓ ${docId} — created`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${docId}: Firestore write failed — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  practitionerContent — created ${created}, updated ${updated}, failed ${failed}`);
}

// ─────────────────────────────────────────────────────────────
// SEEDING — TEACHINGS (E9: the map; stable explicit ids)
// Entries: { id, kind: 'teaching', heldLine, paragraphs[], glossary?[] }
// ─────────────────────────────────────────────────────────────

async function seedTeachings(db) {
  console.log('\n─── Teachings ────────────────────────────────');
  if (!fs.existsSync(TEACHINGS_FILE)) {
    console.log('  no teachings.json; skipping.');
    return;
  }

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(TEACHINGS_FILE, 'utf8'));
  } catch (e) {
    console.log(`  ✗ teachings.json parse error — ${e.message}`);
    return;
  }
  if (!Array.isArray(entries)) {
    console.log('  ✗ teachings.json must be an array');
    return;
  }

  let created = 0, updated = 0, failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const { id, ...doc } = entries[i] || {};
    const errors = [];
    if (typeof id !== 'string' || !id.startsWith('teaching_')) errors.push(`teachings[${i}]: id must be a string starting with "teaching_"`);
    if (doc.kind !== 'teaching') errors.push(`teachings[${i}]: kind must be "teaching"`);
    if (typeof doc.heldLine !== 'string' || !doc.heldLine.trim()) errors.push(`teachings[${i}]: heldLine required`);
    if (!Array.isArray(doc.paragraphs) || doc.paragraphs.some(p => typeof p !== 'string')) errors.push(`teachings[${i}]: paragraphs must be string[]`);
    if (doc.glossary !== undefined && (!Array.isArray(doc.glossary) || doc.glossary.some(g => typeof g !== 'string'))) errors.push(`teachings[${i}]: glossary must be string[]`);
    if (errors.length) {
      errors.forEach(e => console.log(`  ✗ ${e}`));
      failed++;
      continue;
    }

    const ref = db.collection('practitionerContent').doc(id);
    const existing = await ref.get();
    try {
      await ref.set(doc, { merge: true });
      if (existing.exists) {
        console.log(`  ↻ ${id} — updated`);
        updated++;
      } else {
        console.log(`  ✓ ${id} — created`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${id}: Firestore write failed — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  teachings — created ${created}, updated ${updated}, failed ${failed}`);
}

// ─────────────────────────────────────────────────────────────
// SEEDING — MOTIF LEXICON (Task D §1)
// The founder replaces/expands this by editing
// mineral-content/motif-lexicon/lexicon.json — content, not code.
// ─────────────────────────────────────────────────────────────

function validateLexiconEntry(entry, i) {
  const errors = [];
  if (!entry.key) errors.push(`lexicon[${i}]: missing key`);
  if (!Array.isArray(entry.terms) || entry.terms.length === 0) {
    errors.push(`lexicon[${i}] (${entry.key || '?'}): terms must be a non-empty array`);
  }
  if (entry.keyType !== 'motif' && entry.keyType !== 'resistance') {
    errors.push(`lexicon[${i}] (${entry.key || '?'}): keyType must be 'motif' or 'resistance'`);
  }
  return errors;
}

async function seedMotifLexicon(db) {
  console.log('\n─── Motif lexicon ────────────────────────────');
  if (!fs.existsSync(MOTIF_LEXICON_FILE)) {
    console.log('  no lexicon.json; skipping.');
    return;
  }

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(MOTIF_LEXICON_FILE, 'utf8'));
  } catch (e) {
    console.log(`  ✗ lexicon.json parse error — ${e.message}`);
    return;
  }
  if (!Array.isArray(entries)) {
    console.log('  ✗ lexicon.json must be an array');
    return;
  }

  let created = 0, updated = 0, failed = 0;
  const seenKeys = new Set();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const errors = validateLexiconEntry(entry, i);
    if (errors.length) {
      errors.forEach(e => console.log(`  ✗ ${e}`));
      failed++;
      continue;
    }

    // Deterministic doc id — idempotent on repeat runs
    const docId = entry.key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (seenKeys.has(docId)) {
      console.log(`  ✗ lexicon[${i}]: duplicate key "${docId}"`);
      failed++;
      continue;
    }
    seenKeys.add(docId);

    const ref = db.collection('motifLexicon').doc(docId);
    const existing = await ref.get();
    try {
      await ref.set({ key: entry.key, terms: entry.terms, keyType: entry.keyType });
      if (existing.exists) {
        console.log(`  ↻ ${docId} (${entry.keyType}, ${entry.terms.length} terms) — updated`);
        updated++;
      } else {
        console.log(`  ✓ ${docId} (${entry.keyType}, ${entry.terms.length} terms) — created`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${docId}: Firestore write failed — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  motifLexicon — created ${created}, updated ${updated}, failed ${failed}`);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Mineral — content seed');
  console.log(`  content root: ${CONTENT_ROOT}`);
  console.log(`  storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);

  const { db, bucket } = initFirebase();

  await seedEncounters(db, bucket);
  await seedPractitionerContent(db);
  await seedTeachings(db);
  await seedMotifLexicon(db);

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
