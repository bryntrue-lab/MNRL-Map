# Build 14 — Final Scope, Instructions for Replit

Everything below is the complete remaining scope for build 13 (v1.0.0, the App Store submission). Nothing else gets added. Parts 1–2 are client code; Part 3 is a server/content pipeline task; Part 4 is data and console tasks (founder, not code); Part 5 is the native config passenger; Part 6 is the test gate before cutting the build.

First, verify: the day-gate fixes (F5a, F5b) and the Origin date-caption link (N3) appear to be on `main` already (commit `6d579b6`, "Fix Today day gate and Origin date caption interaction"). Confirm all three are in, then proceed.

---

## Part 1 — R1b: the charge capture at the close of the encounter

**Problem:** after the encounter, the close screen dead-ends at `return to the map →`. Testers don't know the next move.

**Design:** a quiet whisper under the primary CTA invites the user to name where the day's charge is — speak it or type it — using the CaptureSheet already mounted in `encounter.tsx`. On save, they land in the Guide, which will hold the new note against everything they've said. Dismissing the sheet unsaved returns to the close screen; nothing is forced. Invitation, not funnel.

All edits in `app/encounter.tsx`:

**1a. Extend the sheet-mode union** (~line 241):

```tsx
const [sheetMode, setSheetMode] = useState<null | "ambient" | "counterweight" | "charge">(null);
```

**1b. Parameterize `closeOut`.** The guide path records completion identically but skips the morning-call interception — the offer flag stays unconsumed and makes its ask on a later close:

```tsx
const closeOut = async (
  dest: "/(tabs)/origin" | "/(tabs)/guide" = "/(tabs)/origin"
) => {
  if (closingRef.current) return;
  closingRef.current = true;
  if (sequence) {
    // Not awaited — offline, the batch commits when connectivity returns;
    // the local snapshot already advances the CTA (§4).
    completeEncounter(uid, encounter.id, turn, profile?.sequenceDay ?? 1).catch(
      (err) => console.warn("completion queued/failed", err)
    );
  }
  // R1b — the charge path: straight to the guide; the morning-call offer
  // stays unconsumed and will make its ask on a later close.
  if (dest === "/(tabs)/guide") {
    router.replace(dest);
    return;
  }
  let offered = morningCallOfferedRef.current;
  if (sequence && Platform.OS !== "web") {
    offered = await wasMorningCallOffered().catch(() => offered);
  }
  if (sequence && Platform.OS !== "web" && !offered) {
    router.replace("/morning-call");
    return;
  }
  router.replace("/(tabs)/origin");
};
```

**1c. REQUIRED companion fix** — the existing close CTA passes `closeOut` bare (~line 1091), which would now feed the press event in as `dest`:

```tsx
// before
onPress={closeOut}
// after
onPress={() => closeOut()}
```

**1d. The whisper**, directly under the primary on the close screen (`LinkWhisper` is already imported):

```tsx
<LinkPrimary
  label="return to the map →"
  onPress={() => closeOut()}
  style={styles.advance}
  testID="close-return"
/>
<LinkWhisper
  label="or ask where today's charge is — speak it"
  onPress={() => setSheetMode("charge")}
  style={{ alignSelf: "center", marginTop: 14 }}
  testID="close-to-guide"
/>
```

**1e. Teach the CaptureSheet instance the new mode** (~line 1099). Charge notes are spontaneous, unlocked type, no encounter ref; saving routes to the Guide:

```tsx
source={sheetMode === "counterweight" || sheetMode === "charge" ? "spontaneous" : "encounter"}
encounterRef={sheetMode === "counterweight" || sheetMode === "charge" ? null : instanceId}
onSaved={() => {
  if (sheetMode === "charge") {
    setSheetMode(null);
    closeOut("/(tabs)/guide");
  } else {
    setToast({ key: Date.now(), text: "kept." });
  }
}}
```

(Leave `lockedType` and `mapRef` logic as-is — `"charge"` matches neither condition, so type stays unlocked and mapRef null, which is correct.)

The existing `closingRef` guard already makes the two close-screen links mutually exclusive on a double-tap. No new state, no new deps.

---

## Part 2 — the footer ladder gets its voice (Guide)

**Problem:** `a reflection →` and `request a letter →` are the least informative labels in the app, on the surface meant to be its deepest.

**Fix:** keep the whisper register; add a derived serif line beneath each, in the style of the lens held-lines. Specific beats loud. In `app/(tabs)/guide.tsx`, footer doors section (~line 794):

```tsx
{shouldShowReflection(notes.length, profile?.readingsEnabled === true) ? (
  <View style={styles.footerDoor}>
    <LinkWhisper
      label="a reflection →"
      onPress={() => setReadingOpen(true)}
      style={styles.readingLink}
      testID="guide-reading-link"
    />
    <Text style={styles.footerHeld}>
      {spellNumber(notes.length)} notes, held together in one reading.
    </Text>
  </View>
) : null}
{shouldShowLetter(notes.length, !user?.isAnonymous && !!user?.email) ? (
  <View style={styles.footerDoor}>
    <LinkWhisper
      label="request a letter →"
      onPress={() => setLetterOpen(true)}
      style={styles.letterLink}
      testID="guide-letter-link"
    />
    <Text style={styles.footerHeld}>
      written by a person, to your field alone.
    </Text>
  </View>
) : null}
```

`footerHeld` mirrors the existing `lensHeld` style (serif, dimmed, small); `footerDoor` centers the pair. `spellNumber` is already imported in guide.tsx. Copy is founder-vetoable — treat the two lines above as draft.

---

## Part 3 — batch-publish the practitioner content (server/pipeline, no build)

**Problem:** the Guide renders zero teachings and zero offerings because nothing was ever published to `practitionerContent` — hundreds of drafts are waiting behind the `approved` toggle.

**Task:** batch-approve ALL drafts, with one safeguard: **before flipping, generate a review report** — every teaching `heldLine` (these render on the Guide's face as lens subtitles) plus a random sample of ~20 offering texts — and hand it to Bryn for a skim. On her go, publish everything.

The publish step must land docs in the exact shapes the client and engine read. The client swallows all content errors silently, so an ID or shape mismatch is invisible — validate, don't assume:

**Teachings** — exactly these doc IDs in `practitionerContent`:
`teaching_resistance`, `teaching_threads`, `teaching_motifs`, `teaching_conditions`, `teaching_consciousness`, `teaching_map`
Shape: `{ kind: "teaching", heldLine: string, paragraphs: string[], closingParagraphIndex?: number }`
(Guide reads `teaching_{lensId}` for held lines; lens pages self-present the full teaching once; Origin reads `teaching_map`.)

**Offerings** — keyed docs, shape `{ key, keyType: "motif" | "resistance" | "condition", text }`, at whatever ID convention the pattern engine's offering-lookup uses — **verify against the engine code that writes `PatternDoc.offerings`** before publishing; don't guess the convention.

**After publishing:** offerings reach users through `PatternDoc.offerings`, written at pattern-compute time. Existing fields (founder, testers, demo account) need a recompute to pick them up without waiting for a new note — run the backfill path (`backfillPatterns`) for those accounts, then open the founder's Guide and confirm: a hero offering in the "FROM THE FIELD" box, held lines under the quiet lenses.

---

## Part 4 — data & console tasks (Bryn, not code)

1. **Flip `readingsEnabled: true`** for all accounts 
2. **Seed the charge field passage** in the gated queue (guide's voice, draft to edit): *"when the threshold closes, the day is already waiting. before it takes you — ask where its charge is. the heaviest thing in front of you, or the brightest. speak it into the field. i'll hold it against everything else you've said."*
3. **Demo account, morning of submission:** capture one or two notes so App Review sees the Guide with today's arrivals alive (the section is day-scoped by design).
4. **App Check console** (separate track, no build dependency): register both apps, upload the DeviceCheck `.p8`, register the dev debug token. Enforcement waits for green metrics; not launch-blocking.

---

## Part 5 — native config passenger (already specced, riding this build)

`app.json` AND its `app.production.json` / `app.development.json` twins:

```json
"ios": {
  "entitlements": {
    "com.apple.developer.devicecheck.appattest-environment": "production"
  }
}
```

New native fingerprint — expected and fine; this build was getting one anyway.

---

## Part 6 — test gate before cutting the build

1. Complete an encounter → close screen shows primary + charge whisper.
2. Tap the whisper → CaptureSheet opens over the close screen → **speak** a charge → lands on the Guide; the note appears (voice: after transcription, under a minute).
3. Repeat with **type instead** → Guide shows the words in today's arrivals immediately.
4. Dismiss the sheet without saving → back on close screen → `return to the map →` still works.
5. Fresh anonymous account, first-ever close → map path still routes to morning-call; guide path doesn't break it (offer arrives on a later close).
6. Completion recorded on BOTH paths (Today shows complete; map shows the day).
7. Guide footer: reflection door visible with its held-line (after flag flip + ≥7 notes); letter door per its gate.
8. Guide shows published teachings (lens subtitles) and a hero offering.
9. Day gates: F5a/F5b scenarios from the build-12 test plan still pass.

Test build 14 in 'dev'
