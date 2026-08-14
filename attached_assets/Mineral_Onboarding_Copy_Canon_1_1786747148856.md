# Mineral — Onboarding Copy Canon (single source of truth)

*Every user-facing string in the onboarding sequence, final and verbatim, in flow order. THE RULE: code matches this document exactly — any string on an onboarding screen that is not in this document is a defect; any change to this document is a founder decision, never an agent improvisation. Render registers: `LinkPrimary` uppercases its label and appends `→` if absent; everything else renders as written.*

## 1. Hello

| Element | String |
|---|---|
| Wordmark | *(SVG, no text)* |
| Subtitle | `a companion for the creative psyche` |
| Secondary link | `already keeping a field? sign in` |
| Primary | `begin →` |

## 2. Entry

| Element | String |
|---|---|
| Eyebrow | `WHERE THE PRACTICE FINDS YOU` |
| Line | `in The Signal` |
| Wheel | *(no text label on the entry wheel — the `PHASE I` SVG label is removed; phases are named by the line below, never numbered)* |
| Eyebrow 2 | `YOUR FIRST TURN` |
| Body | `You're entering at The Signal — where the creative call is felt before it's named.` |

## 3. Signature

| Element | String |
|---|---|
| Eyebrow | `YOUR SIGNATURE` |
| Question (serif) | `When did you arrive?` |
| Subtitle | `This anchors your timing map into your design.` |
| Web placeholder | `birth date (YYYY-MM-DD)` |
| Native empty field | `—` |
| Time field label | `Birth time, if you know it` *(HIDDEN in v1 — behind flag; string reserved)* |
| City field label | `Birth city, State or Province` *(HIDDEN in v1 — behind flag; string reserved)* |
| Save failure | `not kept — try again` |
| Continue without date | `the date anchors the map — or skip below` |
| Skip | `skip · add later` |
| Footer | `continue →` |
| *(Origin-edit variant only)* | `not now` · `save →` |

## 4. Map (the beat)

| Element | String |
|---|---|
| Hold caption (serif) | `you are here.` |
| Hold meta | `{Month Year} · age {N.N}` *(dynamic)* |
| Wander caption (serif) | season title *(dynamic — e.g. `The First Weather`)* |
| Wander meta | `{Month Year} · age {N.N} · cycle {word} · year {word}` *(dynamic)* |
| Whisper | `drag anywhere — the map answers →` |
| CTA (both variants, incl. no-birth still-point) | `continue →` *(whisper register: lowercase, dim — NOT LinkPrimary; renders nothing while the choreography loads/draws, then fades in once settled — no tap target exists before it is visible; exactly one CTA instance)* |

## 5. Practice

| Element | String |
|---|---|
| Eyebrow | `EACH ENCOUNTER` |
| Step 1 | `ONE` · `listen` · `a 3-minute voice guide — a threshold, not a lesson` |
| Step 2 | `TWO` · `reflect` · `speak or write a response — voice is first` |
| Step 3 | `THREE` · `integrate` · `one small practice for the day` |
| Lines | `Your reflections become field notes.` ⏎ `Patterns become a guide.` |
| Connective line | `one encounter keeps each morning. the map holds all of it — wander whenever you want.` |
| Footer | `continue →` |

## 6. Begin

| Element | String |
|---|---|
| Eyebrow | `YOUR FIRST ENCOUNTER` |
| Title (serif) | `The Threshold` |
| Line (serif) | `saying yes to not knowing` |
| Begin button | `Begin` + `3 min · voice` |
| Soft refusal | `the threshold isn't ready — the map is. go there →` |
| Secondary | `save for later` |

## 7. Sign-in branch

| Element | String |
|---|---|
| Guard headline | `this device holds notes that aren't kept.` |
| Guard body | `Signing in to another field will leave them behind — there's no way to bring them along.` |
| Guard primary | `keep them first →` |
| Guard secondary | `sign in anyway` · `cancel` |
| Keep eyebrow | `KEEP THIS FIELD` |
| Keep line | `an email and a password, and it's yours anywhere.` |
| Kept confirmation | `kept. this field is yours, anywhere.` + `return →` |
| Sign-in eyebrow | `ALREADY KEEPING A FIELD?` |
| Sign-in line | `sign in, and it returns.` |
| Form placeholders | `email` · `password` |
| Form primaries | `keep this. →` / `sign in →` |
| Reset | `send a reset link` → `a reset link is on its way.` |
| Back | `← back` |

---

## Changes from the audited build (the complete diff — nothing else moves)

0. *(2026-08-14 additions)* Entry eyebrow: `WHERE YOU'RE BEGINNING` → `WHERE THE PRACTICE FINDS YOU` (founder-authored); entry wheel's `PHASE I` SVG label removed (phases are named, never numbered).
1. restore Hello subtitle: Hello subtitle: `a companion for the creative psyche` 
2. Entry eyebrow: `FIRST TURN OF THE SPIRAL` → `YOUR FIRST TURN` *(two-clock rule: the spiral's revolutions are cycles)*
3. Map CTAs: `tap to continue` → `continue →` (whisper register, lowercase; fades in after the choreography settles; single instance — the overlapping duplicate is removed)
4. Begin line: `something is calling — what comes when you stop naming it?` → `saying yes to not knowing` *(the encounter's own subtitle; the card quotes the encounter rather than paraphrasing it)*

Every other audited string is unchanged and hereby canon.
