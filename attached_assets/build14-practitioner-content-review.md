# Build 14 · practitioner content · REVIEW ONLY

**Awaiting Bryn’s review. Nothing has been approved, published, seeded, purged, or backfilled.**

Live project: **mineral-resonance**, default Firestore database. Collection read time: **2026-10-01T23:41:21.958Z**.
Report generated: 2026-10-01T23:41:22.016Z. Read-only Admin SDK access succeeded using the existing secret; credentials are neither displayed nor saved.

Only practitionerContent and motifLexicon were read. No users, notes, profiles, account identities, or existing user-pattern data were accessed. The utility writes only this local report.

Content snapshot SHA-256 (all content records, sorted by ID): `dbfca438c7770fa19b7e0889c8b223d9e310d34b8e127bc3d484456e367e4960`. This identifies the reviewed snapshot, not authorization to change it.

## 1. Live inventory and key findings

- practitionerContent: **112 documents**, including **6 teachings** and **102 offering documents**.
- **222 actual draft passages** across **74 documents**; **67 already-approved passages**. These are passage-level statuses, not a document-wide approved toggle.
- Required teaching IDs: **6/6 pass shape validation**. Teachings are already stored in practitionerContent; the checked client does not gate them on approved.
- Current motifLexicon: **20 records**. **6/20 lookup IDs have usable top-level text**, **2 exist without text**, and **12 have no practitionerContent document**.
- Therefore the brief’s “nothing was ever published” premise does not match this live snapshot. Admin reads do not prove what a signed-in device can currently render; deployment, auth, stale mounts, and user-pattern state remain unverified.

| keyType | Offering docs | Draft passages | Approved passages | Docs with top-level text |
|---|---:|---:|---:|---:|
| motif | 14 | 3 | 22 | 12 |
| word | 88 | 219 | 45 | 0 |

### Publication hazards — for decision after review, not actions taken

- **word is not an offering keyType supported by the client schema.** The queue derives word keys from thread patterns, but the current pattern engine only requests keyed offerings for motif/resistance lexicon hits. Approving word_* passage statuses alone cannot produce PatternDoc.offerings or a Guide hero offering. Do not silently relabel word keys as motifs: that changes semantics and still requires actual lexicon coverage.
- **Passage approval and hero text are separate paths.** FieldPassageSheet filters passages[].status === approved. The engine reads only the document’s top-level text and does not inspect passage approvals, kind, or keyType before copying it. A status flip cannot populate missing text; an unsafe top-level text copy could expose unreviewed content even with draft passage statuses.
- **kind: offering is required for client read authorization** under the checked-in Firestore rules, even though the brief’s minimal keyed shape omits kind.
- The source queue is currently paused (an unconditional early return). Its inactive generation path produces three generated draft passages per key but does not populate top-level text.
- Current lexicon contains no resistance or condition keyTypes. Conditions findings use a separate hardcoded approved-phrasing mechanism, not condition_* keyed offerings; the current rebuild does not load condition offerings.

Current engine-addressable docs with text: `motif_fire`, `motif_mirror`, `motif_seed`, `motif_support`, `motif_threshold`, `motif_water`.

Existing lookup docs lacking top-level text: `motif_balance`, `motif_body`.

Missing current lexicon lookups: `motif_ache`, `motif_compass`, `motif_home`, `motif_invitation`, `motif_light`, `motif_path`, `motif_posture`, `motif_question`, `motif_room`, `motif_tree`, `motif_voice`, `motif_weight`.

### Content-review flags in the random sample

Exact-word hits against the checked-in passage prompt’s forbidden vocabulary: `word_became[0]: journey`; `word_balance[0]: meaning`; `word_bigger[1]: journey`. This is a mechanical copy check, not an approval or comprehensive editorial assessment.

Tradition/historical claims and locators have not been independently source-checked. Broad attributions such as “Indigenous traditions” or “the ancient Greeks” should receive Bryn’s scholarly review rather than be treated as verified citations. Original texts below are left unchanged.

## 2. ALL live teaching heldLines

Verbatim from Firestore, including teachings already present (not mislabeled as drafts). Required IDs and each shape were checked. Extra fields such as key/keyType and the map glossary are additive.

| Document ID | heldLine (verbatim) | Paragraphs | closingParagraphIndex | Validation |
|---|---|---:|---|---|
| teaching_conditions | nothing grows out of season. | 5 | 3 | PASS |
| teaching_consciousness | your words know where you stand. | 4 | 2 | PASS |
| teaching_map | a life, ever present. | 4 | — | PASS |
| teaching_motifs | the image returns because it is not finished with you. | 4 | 3 | PASS |
| teaching_resistance | the wall you keep meeting knows your name. | 6 | 4 | PASS |
| teaching_threads | what you say twice, you are still saying. | 3 | 2 | PASS |

## 3. Random sample of actual offering drafts

**20 passages**, selected without replacement from all **222 live passages with status draft** using Node crypto.randomInt and a Fisher–Yates shuffle. The sampling unit is a passage, not a key/document; more than one passage from a document is possible. No seeded, historical-export, approved, or invented text substitutes were used. Original array indices are preserved below.

### 1. word_approach · passage index 2 (zero-based)

Key: **approach** · keyType: **word** · status: **draft** · source: **generated**

Locator: as the indigenous peoples understood it

The indigenous traditions often speak of the approach to nature as a relationship rather than a conquest. The land has been read as a living entity, where each step taken in reverence fosters a connection that deepens with each visit. — as the indigenous peoples understood it.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 2. word_anger · passage index 2 (zero-based)

Key: **anger** · keyType: **word** · status: **draft** · source: **generated**

Locator: in indigenous lore

In the lore of Indigenous cultures, anger has been read as a messenger that signals when boundaries have been crossed. It is seen not as something to be suppressed but as a call to honor one's values and protect the community. This understanding fosters a powerful connection to both self and the collective. — in Indigenous lore

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 3. word_became · passage index 0 (zero-based)

Key: **became** · keyType: **word** · status: **draft** · source: **generated**

Locator: in the philosophy of heraclitus

The ancient Greeks spoke of becoming as a process of unfolding — where the potential within a seed was understood to be a journey toward its fullest expression. Becoming was not seen as a destination but as a continuous transformation, where each phase holds its own beauty. — in the philosophy of Heraclitus and the Greeks.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 4. word_belong · passage index 1 (zero-based)

Key: **belong** · keyType: **word** · status: **draft** · source: **generated**

Locator: within Indigenous storytelling

In Indigenous traditions, belonging has been understood as a relationship with the land and ancestors. The stories passed down through generations emphasize that to belong is to be rooted in the earth, a part of a lineage that extends beyond the self. — in Indigenous cultures

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 5. word_another · passage index 1 (zero-based)

Key: **another** · keyType: **word** · status: **draft** · source: **generated**

Locator: in the Greek tradition

The ancient Greeks held that the muse is always present, but only reveals herself when the mind is still. In this reading, the quiet moments before creation are seen as sacred pauses, rich with potential and clarity. — in the Greek tradition

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 6. word_carri · passage index 1 (zero-based)

Key: **carri** · keyType: **word** · status: **draft** · source: **generated**

Locator: sufi teachings

In the teachings of the Sufis, the idea of 'barakah' represents a blessing that flows through intention and action, suggesting that true power comes from alignment with the divine flow. This has been honored as a way to carry one’s spirit into the world. — in Sufi teachings

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 7. word_belief · passage index 0 (zero-based)

Key: **belief** · keyType: **word** · status: **draft** · source: **generated**

Locator: in ancient Greek philosophy

The ancient Greeks understood belief as a kind of binding force, a commitment to the unseen that shaped the world. The texts honored belief not merely as opinion but as a way of engaging with the divine, where faith became a pathway to understanding the cosmos. — as the Greeks read it

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 8. word_arriv · passage index 2 (zero-based)

Key: **arriv** · keyType: **word** · status: **draft** · source: **generated**

Locator: as the Romantics expressed it

The poets of the Romantics celebrated arrival as the moment when nature and self converge, revealing the beauty that exists in the world. This has been read as an awakening, where the heart aligns with the landscape, each arrival a new verse in the ongoing ode to existence. — as the Romantics expressed it

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 9. word_beside · passage index 0 (zero-based)

Key: **beside** · keyType: **word** · status: **draft** · source: **generated**

Locator: in ancient greek thought

The ancient Greeks spoke of the importance of being beside oneself, where the presence of the divine could be felt in moments of ecstasy. This state has been read as a doorway to inspiration, where the self expands to embrace the universe. — in ancient Greek thought.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 10. word_balance · passage index 0 (zero-based)

Key: **balance** · keyType: **word** · status: **draft** · source: **generated**

Locator: in ancient Greek philosophy

In the teachings of the ancient Greeks, harmony was understood as the alignment of opposites. The Pythagoreans celebrated balance not just in music but in life, where every note had its place, and every silence held meaning. This equilibrium was read as essential to the cosmos itself, a guiding principle for all things. — as the Pythagoreans taught it

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 11. word_bigger · passage index 1 (zero-based)

Key: **bigger** · keyType: **word** · status: **draft** · source: **generated**

Locator: in the realm of epic narratives

In the epic narratives, the hero's journey often involves facing giants, representing not just physical foes but the larger-than-life challenges that shape one's destiny. These stories have been read as reflections of the monumental struggles that lead to transformation and growth. — in epic literature traditions

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 12. word_built · passage index 0 (zero-based)

Key: **built** · keyType: **word** · status: **draft** · source: **generated**

Locator: in the tradition of stonemasonry

The ancient builders spoke of the stones that sang in harmony, each one a note in the symphony of the structure. In this way, the act of building has been read as a communal song, where every voice contributes to the whole. — as the stonemasons understood it.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 13. word_break · passage index 0 (zero-based)

Key: **break** · keyType: **word** · status: **draft** · source: **generated**

Locator: in greek philosophy

The ancient Greeks understood the concept of kairos — a moment of opportunity that arrives with the potential for transformation. In their readings, a break in time was seen not as a void but as a pivotal opening, a chance to seize what is possible in the unfolding present. — in Greek philosophy and rhetoric

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 14. word_boundary · passage index 0 (zero-based)

Key: **boundary** · keyType: **word** · status: **draft** · source: **generated**

Locator: in ancient Greek thought

The ancient Greeks revered the concept of hubris, understanding that boundaries set by the gods were not to be crossed without consequence. In this reading, the line between pride and humility has been seen as a sacred measure of one's place in the cosmos. — as the Greeks understood it

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 15. word_basic · passage index 1 (zero-based)

Key: **basic** · keyType: **word** · status: **draft** · source: **generated**

Locator: in Zen tradition

The Zen tradition often speaks of the beginner's mind, where every experience is approached with openness and curiosity. This state has been read as a return to simplicity, allowing for the discovery of profound insights within the mundane. — in Zen teachings

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 16. word_better · passage index 1 (zero-based)

Key: **better** · keyType: **word** · status: **draft** · source: **generated**

Locator: in the cultivation of humanity

In the teachings of Confucius, the notion of ren has been read as the embodiment of benevolence and humanity, emphasizing that true virtue arises from the relationships one nurtures with others. This principle underscores the interconnectedness of personal growth and communal harmony. — in Confucian thought

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 17. word_attention · passage index 2 (zero-based)

Key: **attention** · keyType: **word** · status: **draft** · source: **generated**

Locator: in Zen practice and teachings.

In the practice of Zen, attention is seen as a form of meditation that cultivates awareness. The stillness invites the practitioner to notice the subtleties of existence, where the ordinary becomes extraordinary through careful observation. — as Zen masters have taught.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 18. word_ambition · passage index 1 (zero-based)

Key: **ambition** · keyType: **word** · status: **draft** · source: **generated**

Locator: from the samurai code

In the samurai code, ambition was read as a commitment to honor and duty. The warrior's relentless pursuit of skill and mastery was not selfish but a way to serve and protect, embodying the spirit of bushido. — from the samurai code.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 19. word_already · passage index 1 (zero-based)

Key: **already** · keyType: **word** · status: **draft** · source: **generated**

Locator: as the sufi poets wrote

The Sufi poets often spoke of the 'already' as the divine presence that permeates all things. In this tradition, what is sought has been read as already existing within the heart, waiting to be uncovered through love and devotion. — as the Sufi poets wrote.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

### 20. word_built · passage index 2 (zero-based)

Key: **built** · keyType: **word** · status: **draft** · source: **generated**

Locator: in Renaissance architectural thought

The architects of the Renaissance believed that beauty was a form of order, and every line drawn was a reflection of divine harmony. The structures they created have been read as bridges to the sublime, where geometry and spirit meet. — as the Renaissance architects viewed it.

Engine readiness: unsupported keyType word; top-level text missing/empty. Current lexicon lookup: no.

## 4. Supplemental engine-addressable draft texts

Because the population is mostly word_* content, these are all remaining drafts whose document IDs are actually requested by the current lexicon. This targeted supplement is explicitly NOT part of the random sample.

### S1. motif_body · passage index 0 (zero-based)

Key: **body** · keyType: **motif** · status: **draft** · source: **generated**

Locator: in ancient greek philosophy

In ancient Greek philosophy, the body has been read as the vessel of the soul — a temporary dwelling that shapes experience but does not confine it. The relationship has been honored as one of both tension and harmony, where the physical form serves as a canvas for the inner life. — as the Greeks understood it

Engine readiness: top-level text missing/empty. Current lexicon lookup: yes.

### S2. motif_body · passage index 1 (zero-based)

Key: **body** · keyType: **motif** · status: **draft** · source: **generated**

Locator: in ayurvedic texts

The Ayurvedic texts speak of the body as a sacred temple, a microcosm of the universe that reflects the greater whole. Caring for the body has been read there not merely as self-care, but as an act of reverence toward the interconnectedness of all life. — in Ayurvedic traditions

Engine readiness: top-level text missing/empty. Current lexicon lookup: yes.

### S3. motif_body · passage index 2 (zero-based)

Key: **body** · keyType: **motif** · status: **draft** · source: **generated**

Locator: in the writings of rumi

In the writings of Rumi, the body is often celebrated as a beloved, a manifestation of the divine. The physical form has been honored as a source of joy and longing, where every sensation can lead to a deeper experience of love and connection. — as Rumi expressed it

Engine readiness: top-level text missing/empty. Current lexicon lookup: yes.

## 5. Exact read/write contract from repository code

This section describes existing code; no write path was invoked.

- Teachings: IDs teaching_resistance, teaching_threads, teaching_motifs, teaching_conditions, teaching_consciousness, teaching_map; shape { kind: "teaching", heldLine: string, paragraphs: string[], closingParagraphIndex?: number }. Optional index is zero-based and must be in range.
- Guide reads teaching_{lens.id} once per mount and accepts heldLine only for kind teaching; errors silently become empty strings. Lens routes read the same IDs. Origin reads teaching_map.
- Offering lookup ID: keyType + "_" + key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""). Example: motif + "Water" → motif_water; resistance + "Self Doubt" → resistance_self-doubt. Original key (not slug) is retained in PatternDoc.offerings.
- Required keyed client payload is { key: string, keyType: "motif" | "resistance" | "condition", text: string }; add kind: "offering" for client access under current rules. Passage-sheet content additionally needs passages[] entries { text, locator: string|null, status: "approved"|"draft", source: "founder"|"generated", createdAt: Timestamp }.
- Engine loadOfferings / offeringsFromSnapshots read top-level text. rebuildPatternsForUser writes { [originalKey]: { key: originalKey, text } } to users/{uid}/patterns/resistance.offerings for resistance hits and users/{uid}/patterns/motif.offerings otherwise. Guide’s hero reads patterns[hero.type].offerings[hero.key]. It separately watches motif_{hero.key} for approved passage-sheet content.
- The actual queue stores { key, keyType: "motif"|"word", kind: "offering", passages: [three drafts] } at {keyType}_{slug}; it omits text. Its slug replacement does not trim edge hyphens, unlike the engine, although the queue’s current single-word alphabetic filter avoids that difference.
- The seed migration maintains both passages and a compatibility text field. Rerunning the seed is NOT a safe review operation: it performs writes and marks seeded passages approved. No seed was run.
- backfillPatterns callable is authenticated and self-only: it rebuilds request.auth.uid. It does not accept an arbitrary target UID for founder/tester/demo bulk work. No callable, rebuild, generation lease, or backfill was run.

### Source anchors

- functions/fieldQueue.js:10–12, 18–40, 44–58, 144–182, 198–212 — IDs, passage drafts, word candidates, storage, paused scheduler.
- seed-content/MNRL-seed-content/mineral-content/practitioner-content/passage-prompt.json — forbidden vocabulary used for the narrow sample check.
- functions/patternEngine.js:781–811, 855–885, 1079–1111, 1146–1151 — exact offering lookup, hits, live rebuild, PatternDoc.offerings assignment.
- functions/index.js:367–381 — actual backfillPatterns callable.
- artifacts/mineral/types/firestore.ts:211–215, 259–276 — PatternDoc and practitioner content types.
- artifacts/mineral/app/(tabs)/guide.tsx:267–290, 353–372 — teaching subtitles, hero offering, approved-passage watcher.
- artifacts/mineral/app/lens/[lens].tsx:123–141, 239–241 — teaching read and motif keyed-content read.
- artifacts/mineral/app/(tabs)/origin.tsx:420 — teaching_map read.
- artifacts/mineral/lib/fieldPassages.ts:4–13 — approval filter.
- firestore.rules:13–18 — kind-based authenticated reads; client writes denied.
- seed-content/MNRL-seed-content/seed/seed-content.js:174–213, 392–445 — offering migration and explicit teaching IDs.

## 6. Complete offering readiness inventory

PASS here means the keyed shape and kind are usable, not that Bryn has approved anything in this session. “Lexicon lookup” means a key can be requested if matched in a note, not proof it appears in any account’s current field. All counts refer to this snapshot.

| Document | keyType | Draft / approved passages | Top-level text | Lexicon lookup | Shape issues |
|---|---|---:|---|---|---|
| motif_animal | motif | 0 / 1 | yes | no | PASS |
| motif_balance | motif | 0 / 3 | no | yes | top-level text missing/empty |
| motif_body | motif | 3 / 0 | no | yes | top-level text missing/empty |
| motif_door | motif | 0 / 3 | yes | no | PASS |
| motif_dream | motif | 0 / 1 | yes | no | PASS |
| motif_fire | motif | 0 / 1 | yes | yes | PASS |
| motif_flame | motif | 0 / 1 | yes | no | PASS |
| motif_longing | motif | 0 / 1 | yes | no | PASS |
| motif_mirror | motif | 0 / 1 | yes | yes | PASS |
| motif_seed | motif | 0 / 1 | yes | yes | PASS |
| motif_star | motif | 0 / 1 | yes | no | PASS |
| motif_support | motif | 0 / 3 | yes | yes | PASS |
| motif_threshold | motif | 0 / 1 | yes | yes | PASS |
| motif_water | motif | 0 / 4 | yes | yes | PASS |
| word_abandon | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_ability | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_able | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_absolutely | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_accept | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_acceptance | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_accountability | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_achievement | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_action | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_actually | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_adjust | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_admit | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_adult | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_advice | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_agreement | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_ahead | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_allow | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_almost | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_alone | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_along | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_already | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_ambition | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_amend | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_anger | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_another | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_answer | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_anxiety | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_anymore | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_apart | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_apologize | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_appear | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_appreciate | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_approach | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_approval | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_argu | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_argument | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_arriv | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_arrive | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_assum | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_assumption | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_attempt | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_attention | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_available | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_avoid | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_avoidance | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_awareness | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_away | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_balance | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_barrier | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_basic | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_beat | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_became | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_becom | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_become | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_began | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_begin | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_behavior | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_behind | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_belief | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_believ | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_believe | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_belong | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_benefit | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_beside | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_best | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_better | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_beyond | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_bigger | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_body | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_borrow | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_boundary | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_brain | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |
| word_break | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_breakthrough | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_bring | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_broken | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_build | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_built | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_burden | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_burn | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_busy | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_call | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_calm | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_care | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_career | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_carefully | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_carri | word | 3 / 0 | no | no | unsupported keyType word; top-level text missing/empty |
| word_cast | word | 0 / 3 | no | no | unsupported keyType word; top-level text missing/empty |

## 7. Review gate and limits

**Stop here for Bryn.** This report is not approval. No content edits, status flips, document moves, publications, account changes, recomputes, deployments, or git branch/commit operations were performed.

Before any later publication, obtain explicit approval and resolve word-key semantics, missing text, and lexicon gaps. Preserve approved founder passages and agree which reviewed passage becomes compatibility text. Re-read content to catch changes since this fingerprint. Account-specific recomputes require separately authorized authenticated self-callables or a properly scoped administrative path.

Not verified: deployed functions/rules parity, signed-in Guide rendering, founder/tester/demo PatternDoc state, account-specific hero eligibility. Admin collection reads bypass client rules. No UI authentication bypass or user-account read was attempted.

Re-run utility (read-only remote access; replaces this local report with a fresh snapshot/sample):

    node seed-content/MNRL-seed-content/seed/review-practitioner-content.js
