#!/usr/bin/env node
/**
 * Mineral — dump generated draft passages for founder review.
 *
 * READ-ONLY: collects every passages[] entry with status "draft" from
 * practitionerContent and writes them to drafts-review.md next to this
 * script, grouped by key. Never writes to Firestore.
 *
 * Run from the seed/ directory (same credentials as the seed script):
 *   node dump-drafts.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initFirebase() {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } catch (e) {
      console.error('ERROR: FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    console.error('ERROR: set FIREBASE_SERVICE_ACCOUNT (Replit) or GOOGLE_APPLICATION_CREDENTIALS (local).');
    process.exit(1);
  }
  admin.initializeApp({ credential });
  return admin.firestore();
}

async function main() {
  const db = initFirebase();
  const snap = await db.collection('practitionerContent').get();

  const sections = [];
  let total = 0;

  const docs = snap.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(d => Array.isArray(d.data.passages))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const { id, data } of docs) {
    const drafts = data.passages.filter(p => p && p.status === 'draft');
    if (!drafts.length) continue;
    total += drafts.length;
    const lines = [`## ${data.key ?? id} (${id})`, ''];
    drafts.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.text}`);
      lines.push(`   — locator: \`${p.locator ?? '(none)'}\` · source: ${p.source ?? 'generated'}`);
      lines.push('');
    });
    sections.push(lines.join('\n'));
  }

  const out = [
    '# Mineral — generated draft passages (review before purge)',
    '',
    `*${total} drafts across ${sections.length} keys, exported ${new Date().toISOString().slice(0, 10)}. Read-only export — nothing in Firestore changed.*`,
    '',
    '*To keep one: flip its `status` to `"approved"` in the console (the G2b purge spares approved entries), or better, save the text and reseed it as a founder passage with your edits.*',
    '',
    sections.join('\n'),
  ].join('\n');

  const outPath = path.join(__dirname, 'drafts-review.md');
  fs.writeFileSync(outPath, out);
  console.log(`wrote ${outPath} — ${total} drafts across ${sections.length} keys`);
  process.exit(0);
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });
