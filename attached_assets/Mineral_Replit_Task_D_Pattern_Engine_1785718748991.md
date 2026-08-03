# Mineral — Replit Task D: The Pattern Engine + The Field Guide

*Self-contained build task. Prerequisites: the slice re-run through Slice 2.1 (the Guide's interim state exists). Runs as its own sliced sequence (D.1 engine, D.2 Guide — below). Where this conflicts with older documents, THIS DOCUMENT WINS. The governing law is the first commitment: the engine counts and quotes verbatim; it never interprets, diagnoses, or names what the user is doing. If a feature idea requires the engine to produce a sentence about the user, the answer is no.*

---

## 0. Decisions already made (do not reopen)

1. **The mirror shows something every time.** From the first note onward, every Guide visit surfaces counted truth. This is achieved by counting ARRIVALS (first occurrences), not by lowering the bar for patterns.
2. Three tiers, mechanical: **arrival** (count 1) → **gathering** (count 2) → **established** (count ≥ 3: threads and motifs). Tier language is fixed (§4); no other adjectives ever attach to an item.
3. No LLM anywhere in this milestone. Lexicon matching + stopword-filtered word/phrase frequency only.
4. `charge` stays null. Conditions and Consciousness lenses stay in their listening state (keep their promise lines from Slice 2.1).
5. Clients never write to `patterns` (rules already enforce). The engine is Admin SDK only.

## 1. Slice D.1 — the engine (Cloud Functions only; zero app-code changes)

**Trigger:** one function, firing on fieldNote create (text captures) and on update when `transcriptStatus` flips to `done` (audio). Guard against double-processing with a `processedAt` timestamp ON THE PATTERN DOCS' per-item records, not on the fieldNote (clients own fieldNotes; keep a `processed` ledger inside each pattern doc: array of fieldNote ids, capped reasonably).

**Pipeline per note (content available):**
1. Normalize: lowercase, strip punctuation, lemmatize lightly (plurals, -ing/-ed; a small stemmer is fine — no NLP service).
2. **Words:** extract content words (stopword list ~200 common English words; keep everything else, including the user's odd words — odd words are the good ones). Update the `thread` pattern doc: `itemCounts[word]++`, exemplar upsert (the full verbatim sentence containing it, capped 3, most recent kept).
3. **Phrases:** extract 2–5-word n-grams (stopword-boundary-aware). Same doc, same counting. Phrases and words live together in the `thread` doc — the lens is "your recurring language."
4. **Motifs:** match the normalized text against the practitioner **motif lexicon** (new `motifLexicon` collection: `{ key, terms: string[], keyType: 'motif'|'resistance' }`, seeded via the existing seed-script pattern; founder authors content). Update the `motif` pattern doc (and `resistance` doc for resistance-keyed entries): counts, exemplars, and copy in any matching `practitionerContent` offering.
5. Set `updatedAt` on touched docs.

**On fieldNote delete:** decrement every count the note contributed; remove its exemplars; drop it from the processed ledger. A deleted note leaves no residue.

**Seed content shipped with this slice:** a starter `motifLexicon` of ~20 entries mined from the seeded week's imagery (door/threshold, seed, tree, compass, ache, posture, question, invitation, voice, path, support, balance, room, mirror, body, fire, water, light, weight, home) with obvious term variants. The founder replaces/expands this by editing content, not code.

*Gate D.1: create a text note containing "the door keeps appearing" → within seconds the thread doc counts door/appearing (words), the motif doc counts door with the verbatim sentence as exemplar; delete the note → all of it reverses.*

## 2. Slice D.2 — the Field Guide (app code; Guide tab only — touch nothing else)

The Guide reads ONLY `users/{uid}/patterns/*` (plus the last 3 notes for FRESH, unchanged from Slice 2.1). Top to bottom:

**The synthesis sentence** — always present, chosen by precedence, engine voice (counts only):
1. Any item ≥ 3: *"The door appears in 4 of your 9 notes."* (highest-count item)
2. Else any item = 2: *"Support has appeared twice."*
3. Else (first visit of a day with new notes): *"Three words entered your field today."*
4. Else: *"N notes across M days."*

**TODAY'S ARRIVALS** (the every-time layer): a quiet row of word-chips — the content words that appeared for the FIRST time in today's notes, verbatim, lowercase, max 7 (most recent first; drop silently beyond 7). Present every day the user captures. No arrivals row on days without captures.

**GATHERING**: items at count 2, as small rows — *support · twice* — each expandable to its two verbatim exemplars. This section is the anticipation engine; it appears whenever anything sits at two.

**The three live lenses** (rows open to full lens views):
- **your recurring language** (threads): items ≥ 3 from the thread doc, phrases before single words, top 7 by count. Each: item · count · exemplars (verbatim, attributed: *reflection · the threshold · 3 days ago*).
- **mythic motifs**: lexicon items ≥ 1 (motifs may show at count 1 — a named image arriving IS the observation), count-ordered, exemplars + "from the field" offering where one exists (offering rendering per style guide: lower-opacity sans container, passive voice).
- **recurring resistance**: resistance-typed note count + resistance-keyed lexicon items, same shape.
- conditions noted / consciousness map: unchanged listening state with promise lines.

**YOUR WORDS, RETURNING** and **FRESH** stay as built in Slice 2.1.

**Post-encounter freshness moment** (the *taking root* animation from the style guide's animation spec): when the Guide is first opened after an encounter completes, the eyebrow pulses in, the synthesis sentence lands at 600ms, the freshest fragment underlines left-to-right. Once per completion, never on ordinary opens.

*Gate D.2: with the founder's existing two test notes, the Guide shows — synthesis "Support has appeared twice." · arrivals chips from the latest note · GATHERING: support with both exemplars · lenses populated per thresholds; a third note containing "support" promotes it to your recurring language with all three quotes.*

## 3. Copy rules (verbatim, complete)

Tier words are fixed: *entered your field* (arrival) · *has appeared twice* (gathering) · *appears in N of your notes* (established). Forbidden anywhere in the Guide: theme, insight, meaning, journey, progress, streak, "your clearest," "you seem," "you tend," any sentence with the user as subject of an interpretive verb. Attribution format everywhere: `type · source · relative time`. Numbers under ten spelled out in synthesis sentences; numerals in counts (*support · 2 notes*).
