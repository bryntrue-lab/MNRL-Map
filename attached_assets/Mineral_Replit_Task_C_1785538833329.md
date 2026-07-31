# Mineral — Replit Build Task C: Identity, Accounts, Onboarding & Copy Reconciliation

*Self-contained build task. Prerequisites: Tasks A and B are merged and working. Where this document conflicts with anything in the repo or older documents, THIS DOCUMENT WINS. Attached alongside: `icon-assets/` (the app icon set — use these files, do not redraw), `Mineral_Origin_Prototype.html` (behavioral reference), `Mineral_Style_Guide.md` + `Mineral Design System v6.html` (design reference; superseded where noted).*

**Project:** `mineral-resonance` · Expo / React Native / Firebase JS SDK v12 · expo-router · one new callable Cloud Function.

---

## 0. Decisions already made (do not reopen)

1. **Vocabulary ruling — cycle vs. turn.** A **cycle** is the 28-year revolution of the life map. A **turn** is one revolution through the four phases — the 108-day practice. This resolves an overload: all life-scale surfaces that currently say "turn" change to "cycle" (§5); the practice wheel's "⤢ this turn" is already correct and stays.
2. **The business model of record:** the first seven days (the first week of Signal) are free in full; from day 8 the practice is member-only. The map and capture remain free. **Nothing in this task implements gating or billing** — that is the next milestone — but no copy written in this task may contradict this model (in particular, ignore the "three encounters free" section of the v6 design system).
3. **Anonymous-first stays.** Account creation is an upgrade to the existing anonymous user via `linkWithCredential` — never a new account, never a login wall.
4. Timing not progress; chapel voice for all in-app copy; one gradient-defining file. As ever.

---

## 1. App identity (the icon you see on the home screen)

Wire the provided assets — do not generate or redraw them:

- `icon-assets/icon-1024.png` → `app.json` `expo.icon` (full-bleed square; iOS masks it).
- `icon-assets/adaptive-icon-foreground.png` + `adaptive-icon-background.png` → `expo.android.adaptiveIcon` (`foregroundImage` / `backgroundImage`).
- `icon-assets/splash-icon.png` → `expo.splash.image`, `backgroundColor: "#0A0610"`, `resizeMode: "contain"`.
- Display name **Mineral**; set `ios.bundleIdentifier` and `android.package` (e.g. `com.mineral.app` — confirm with the founder before first EAS build), `version: "1.0.0"`, auto-increment build numbers.
- `icon-assets/mineral-icon.svg` is the vector source of truth — commit it to the repo under `assets/brand/`.

Verify the icon and splash render on a device build, not just Expo Go.

## 2. The account moment (`linkWithCredential`)

**Trigger:** after the user's FIRST crystallizing capture completes — on the encounter close screen (Task B §1g), after the epigraph, before returning to the map. Once, ever.

**The screen:** atmosphere continuous with the close; serif italic headline — *"keep this."* — with the line beneath: *"and everything else that finds you."* Then, plainly: email + password fields and one quiet button: *"keep it →"*. A dismiss affordance — *"not now"* — small, beneath. No benefits list, no modal urgency. Copy is final.

**Behavior:** `linkWithCredential(EmailAuthProvider.credential(email, password))` on the current anonymous user — the uid, and therefore every fieldNote and userEncounter, is preserved. Write `email` to the user doc. On `auth/email-already-in-use` or `auth/credential-already-in-use`: show one quiet line (*"that address already keeps a field. try another, or come back later."*) — do NOT sign the user into the other account in v1 (merging two fields is out of scope; don't destroy the anonymous field by switching uids).

**If dismissed:** the user stays anonymous; a small row appears in Settings — *"keep your field · add an email"* — as the permanent path back. Do not re-prompt in the flow.

## 3. Account deletion (required by App Store policy once accounts exist)

A **callable Cloud Function** `deleteAccount` (Admin SDK) — do not attempt this cascade client-side:

1. Delete the Storage prefix `users/{uid}/` (all voice recordings).
2. Recursively delete the Firestore tree `users/{uid}` (fieldNotes, userEncounters, patterns, the user doc) — use the Admin SDK recursive delete.
3. Delete the Auth user.

Order matters: Storage first (an orphaned recording is the unrecoverable failure), Firestore second, Auth last. Any step failing aborts with an error the client surfaces as *"something held on. try again."* — retryable, never partial-silent.

**Client:** Settings → *"leave, and take everything with you"* → one confirmation screen stating plainly and completely: *"This deletes your field — every note, every recording, everything — permanently. There is no way back."* Confirm button held for 2 seconds (deliberate friction, once). On success: sign out to the hello screen.

## 4. Onboarding — the five screens, merged with the first-run map

Replace Task A's single birth-date screen with the v6 §8 flow, reconciled with the first-run choreography. Final order:

1. **Hello** — the mark, *"a companion for the creative psyche"*, `begin →`. Nothing else.
2. **The spiral** — the wheel with North glowing: eyebrow `WHERE YOU'RE BEGINNING`; *"You're entering at The Signal — where the creative call is felt before it's named."*
3. **Your signature** (optional, one-tap skip) — eyebrow `YOUR SIGNATURE`; *"When were you born?"*; value line: *"This anchors your spiral life map and reveals your Human Design."*; fields: birth date, birth time (optional), birth location (optional); `skip · add later`. Writes `birthDate` / `birthTime` / `birthLocation` to the user doc. (Human Design computation itself is NOT in scope — fields captured only.)
4. **The map draws itself** — if a birth date was given, the Origin tab's first-run choreography (Task A §8) plays HERE, as the payoff of the signature. If skipped, a still-point-only moment with *"you are here."* This replaces any static wheel explainer.
5. **The practice** — the three-step shape (listen / reflect / integrate) with the closing line *"Your reflections become field notes. Patterns become a guide."*
6. **Begin** — first encounter card: `YOUR FIRST ENCOUNTER` / *The Threshold* / subtitle / `Begin · 3 min` / *save for later*. Begin enters the encounter flow. **Save for later** writes `userEncounters/the-threshold_t1` with `status: 'saved'` and lands on the Origin tab (the CTA still offers today's encounter).

Anonymous sign-in still happens silently at app start, before any of this.

## 5. Copy reconciliation patches (small, exact)

- **cycle/turn:** on all life-scale surfaces replace the word "turn" with "cycle": the Origin HUD (`cycle two` / `year twenty-three`), the wander caption (`… · cycle two · year nine`), companion descriptors (*"the same season, one cycle behind"* / *"one cycle ahead"*). Variable names may stay as-is; this is UI copy only. The practice wheel's `⤢ this turn` and its `Signal · day five` caption are unchanged.
- **Warm-up reveal (if Task B shipped without it):** on the ⟡ screen, beneath the capture affordance, a quiet reveal — `NEED A WAY IN? ↓` — expanding to the encounter's non-crystallizing prompts from the same reflection block, read-only invitations (no capture per prompt; the ⟡ remains the single capture). Collapsed by default, always.
- **Permission strings:** iOS `NSMicrophoneUsageDescription`: *"Mineral records your voice reflections — they stay in your field."* Android `RECORD_AUDIO` via the expo-av plugin config. No other permissions in v1 (no push, no location — the birth-location field is typed, not GPS).

## 6. First EAS build → TestFlight

- `eas.json` with `development`, `preview`, `production` profiles; `eas build --platform ios --profile production`; `eas submit -p ios` to the App Store Connect record (founder completes Apple Developer enrollment and creates the app record; agent wires config and documents the two commands).
- Confirm: icon on the home screen, splash on cold start, mic permission prompt shows the copy above, auth session survives force-quit and reboot.

## 7. Acceptance checklist

- [ ] Home screen shows the spiral mark; splash is the mark on `#0A0610`.
- [ ] Fresh install → hello → spiral → signature (skip works; fields persist when given) → map draws → practice → begin; *save for later* writes `saved` and lands on the map.
- [ ] First crystallizing capture → *keep this.* screen appears exactly once; linking preserves uid and all prior notes (verify the same fieldNotes exist after linking); email-in-use shows the quiet line and changes nothing.
- [ ] Dismissing leaves the Settings row as the path back; no re-prompting.
- [ ] `deleteAccount` removes Storage prefix, Firestore tree, and Auth user (verify all three in consoles); a forced mid-cascade failure surfaces the retry line and leaves no orphaned audio.
- [ ] All life-scale surfaces read "cycle"; the practice wheel still reads "turn"; grep the codebase for user-facing "turn" strings on Origin life-view components → zero.
- [ ] ⟡ screen shows the collapsed `NEED A WAY IN? ↓` reveal with the seeded encounters' warm-up prompts.
- [ ] TestFlight build installs; mic prompt shows the Mineral copy; no progress indicators have crept in anywhere.
