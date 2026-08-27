#!/usr/bin/env node
/**
 * Mineral — one-way epigraph sync: Firestore → local seed JSONs.
 *
 * WHY THIS EXISTS: the day 1–7 `mapEpigraph` values (the morning-call bodies
 * / Today-screen epigraphs) were added directly in the Firestore console and
 * never made it back into mineral-content/encounters/*.json. seed-content.js
 * writes with a FULL-OVERWRITE set(), so re-running the seed with the local
 * files as they stand would strip those lines from production.
 *
 * Run this ONCE before the next seed: it reads each live encounter doc and
 * copies its mapEpigraph into the matching local JSON (inserted right after
 * "subtitle"). It NEVER writes to Firestore — one direction only, live → disk.
 *
 * Usage (same credentials as the seed script, from the seed/ directory):
 *   node pull-epigraphs.js
 *
 * Then eyeball `git diff` / the files, and run `npm start` as usual.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const ENCOUNTERS_DIR = path.resolve(__dirname, '..', 'mineral-content', 'encounters');

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
  console.log('Mineral — epigraph sync (Firestore → local JSON)\n');
  const db = initFirebase();

  const files = fs.readdirSync(ENCOUNTERS_DIR).filter(f => f.endsWith('.json')).sort();
  let updated = 0, inSync = 0, noLive = 0, noEpigraph = 0;

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const filePath = path.join(ENCOUNTERS_DIR, file);
    const local = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const snap = await db.collection('encounters').doc(slug).get();
    if (!snap.exists) {
      console.log(`  · ${slug} — no live doc yet (not seeded); leaving local file as-is`);
      noLive++;
      continue;
    }

    const liveEpigraph = snap.data().mapEpigraph;
    if (liveEpigraph === undefined || liveEpigraph === null || liveEpigraph === '') {
      console.log(`  · ${slug} — live doc has no mapEpigraph (subtitle fallback in effect)`);
      noEpigraph++;
      continue;
    }

    if (local.mapEpigraph === liveEpigraph) {
      console.log(`  = ${slug} — already in sync`);
      inSync++;
      continue;
    }

    // Rebuild the object with mapEpigraph placed right after subtitle,
    // dropping any stale local value first.
    const out = {};
    let placed = false;
    for (const [k, v] of Object.entries(local)) {
      if (k === 'mapEpigraph') continue;
      out[k] = v;
      if (k === 'subtitle') {
        out.mapEpigraph = liveEpigraph;
        placed = true;
      }
    }
    if (!placed) out.mapEpigraph = liveEpigraph;

    fs.writeFileSync(filePath, JSON.stringify(out, null, 2) + '\n');
    console.log(`  ✓ ${slug} — wrote mapEpigraph: "${liveEpigraph}"`);
    updated++;
  }

  console.log(`\n  synced ${updated}, already in sync ${inSync}, no live doc ${noLive}, no live epigraph ${noEpigraph}`);
  console.log('  Local files now carry the live morning lines — the next seed run is overwrite-safe.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});