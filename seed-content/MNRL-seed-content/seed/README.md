# Mineral · Content Seed

Idempotent Node script (Admin SDK) that writes `encounters` and `practitionerContent` to Firestore, and uploads encounter audio to Cloud Storage.

## Directory layout

The script assumes this layout, all paths relative to the project root:

```
mineral-content/
├── encounters/
│   ├── the-threshold.json
│   ├── the-ache-is-a-compass.json
│   └── ...                              ← one JSON per encounter, slug = doc id
├── practitioner-content/
│   └── offerings.json                   ← array of { key, keyType, text }
└── audio/
    ├── enc1_MNRL26.mp3
    ├── enc2_MNRL26.mp3
    └── ...                              ← referenced by each encounter's audioFile

seed/
├── seed-content.js                      ← this script
├── package.json
└── README.md
```

The `audio/` directory holds the source recordings. The script uploads each to Storage at `encounters/{slug}/audio.mp3` — Storage paths use the slug, so file naming on your side stays under your control.

## One-time setup

**Install dependencies:**

```bash
cd seed
npm install
```

**Get a service-account credential.** In the Firebase console:

1. Project settings → Service accounts
2. Generate new private key → download the JSON
3. Save it somewhere outside the repo — treat it like a password. **Never commit it.**

The service account needs Firestore write and Storage write. The default Firebase Admin SDK service account (`firebase-adminsdk-*`) has both.

**Set environment variables:**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
export FIREBASE_STORAGE_BUCKET=mineral-resonance.appspot.com
```

Storage bucket name: check Firebase console → Storage → the bucket URL. Modern projects use `<projectId>.firebasestorage.app`; older ones use `<projectId>.appspot.com`. Either is fine — use whichever your project shows.

## Running

```bash
npm start
```

Sample output on a first clean run:

```
Mineral — content seed
  content root: /path/to/mineral-content
  storage bucket: mineral-resonance.appspot.com

─── Encounters ───────────────────────────────
  ✓ living-the-question (order 6, signal) — created + audio
  ✓ remembering (order 3, signal) — created + audio
  ✓ the-ache-is-a-compass (order 2, signal) — created + audio
  ✓ the-quiet-yes (order 5, signal) — created + audio
  ✓ the-returning-signal (order 4, signal) — created + audio
  ✓ the-soul-has-a-posture (order 7, signal) — created + audio
  ✓ the-threshold (order 1, signal) — created + audio

  encounters — created 7, updated 0, failed 0

─── Practitioner content ─────────────────────
  ✓ motif_seed — created
  ✓ motif_flame — created
  ✓ motif_fire — created
  ...

  practitionerContent — created 10, updated 0, failed 0

Done.
```

Re-running it: the `✓ created` markers become `↻ updated`. Documents are keyed by slug, so nothing duplicates.

## What it validates before writing

Per encounter, before any Firestore write or Storage upload:

- All required top-level fields present (`title`, `subtitle`, `phase`, `order`, `minTurn`, `audioPath`, `blocks`)
- `phase` is one of `signal | field | friction | voice`
- `order` and `minTurn` are positive integers
- Every block has a valid `type`
- Every prompt has an `id` and `text`
- Prompt ids are unique within the encounter
- At most one prompt in `blocks[]` is `crystallizing: true` (same check on `deepDive[]`)
- No `order` collision across encounters in the same `phase` in this run

A file that fails validation is skipped with a listed reason; the script continues with the rest. Nothing partial is written.

## Idempotency

Everything is keyed by slug. Re-runs update in place; nothing duplicates. This means:

- Editing an encounter's JSON and re-running updates the doc.
- Replacing an audio file and re-running re-uploads it at the same Storage path (client fetches will pick up the new one).
- Nothing is ever deleted by the seed. To remove an encounter, delete the Firestore doc directly (and its Storage folder).

## Testing before you seed production

**Option 1 — dry run against the emulator.** Start the Firebase emulators locally:

```bash
firebase emulators:start --only firestore,storage
```

Then export `FIRESTORE_EMULATOR_HOST=localhost:8080` and `FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199` before running `npm start`. Writes hit the emulator, not production.

**Option 2 — seed a test project first.** If you have (or create) a separate Firebase project for staging, point `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_STORAGE_BUCKET` at that project, run the seed, and verify in the console.

For the first real run against `mineral-resonance`: seeding is idempotent, so even if you make a mistake, you can fix the JSON and re-run — the doc gets overwritten. The one thing that persists across bad runs is Storage audio (deletes are never automatic), so if you upload the wrong audio, delete it from Storage manually before re-running.

## Verifying the seed landed

**Firestore console → Data:**
- `encounters` collection has 7 docs, one per slug
- Each doc has `blocks: [...]` with typed blocks, plus the top-level fields
- `practitionerContent` collection has 10 docs, one per offering

**Storage console:**
- `encounters/the-threshold/audio.mp3` (and 6 others) exist

**Rules Playground quick check** (in the Firestore Rules tab):
- Authenticated read on `encounters/the-threshold` → allow
- Unauthenticated read → deny
- Any client write on `encounters/the-threshold` → deny (Admin SDK bypasses this — that's expected)

## Common issues

**`ERROR: GOOGLE_APPLICATION_CREDENTIALS must point at a service-account JSON.`**
Path env var not set or file doesn't exist. Use an absolute path.

**`ERROR: FIREBASE_STORAGE_BUCKET must be set.`**
Set to your bucket name — the one shown in Firebase console → Storage.

**`local audio not found: enc1_MNRL26.mp3`**
The encounter's `audioFile` references a file not in `mineral-content/audio/`. The Firestore doc still writes (audio is optional at seed time); the audio can be uploaded later by placing the file and re-running.

**`order N in phase "signal" collides with X`**
Two encounters in the same phase share an `order`. Fix one of the JSON files.

**`blocks[] contains 2 crystallizing prompts (max 1)`**
An encounter has more than one prompt marked `crystallizing: true` in the main flow. Only one is allowed per `blocks[]` (and one more per `deepDive[]`).

## What NOT to do

- **Never commit the service-account JSON.** Add `*.json` for the credentials location to `.gitignore` if the file lives in the repo, or keep it entirely outside the repo tree.
- **Never run this script against production while pointing at test data**, or vice versa. Double-check `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_STORAGE_BUCKET` before `npm start`.
- **Don't rename slugs after seeding.** The slug is the Firestore doc id and the Storage folder — renaming means orphaning existing data. If you must rename, rename the JSON *and* delete the old doc + Storage folder before re-running.
