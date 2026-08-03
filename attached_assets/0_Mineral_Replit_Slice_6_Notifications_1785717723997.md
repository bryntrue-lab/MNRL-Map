# Mineral — Slice 6: Daily Notification + Sunrise Option (copy spec, canonical)

*Companion to the Rerun Plan's Slice 6 — this is the "notification copy spec + sunrise amendment" it cites, now in one document. The mechanics in the slice text stand; THIS document is the authority for every string. Do not improvise any copy. Local notifications only — no push infrastructure, no Push Notifications capability, ever, in this slice.*

---

## 1. The body is data, not copy

Each scheduled notification's body is the `mapEpigraph` of the encounter at the user's **current sequence pointer**, reproduced *exactly* as stored — same case, same final period, nothing added. Fallback chain if `mapEpigraph` is null: the encounter's `subtitle`; if no encounter doc exists for the pointer: `the map is holding today.` Never any other generated text.

**Worked examples (the seeded week, for verification):**

- Day 1 → `The door is already open.`
- Day 2 → `The unfinished thing is still pointing.`
- Day 3 → `The seed remembers the tree.`
- Day 5 → `It asked again.`

## 2. Hard rules

- **No title** — omit the title field entirely; the OS shows only "Mineral" + the line.
- No emoji. No exclamation marks. No calls to action — "tap to…", "don't miss…", "keep your streak" are all forbidden. If you find yourself writing words not present in Firestore, stop.
- **Silent delivery** (`sound: null`) — the map waits on the lock screen; it does not ping.
- Tap opens the app on the **Origin tab**.
- OS-level permission denied → total silence. No nag banners, no in-app reminders, ever.

## 3. Fixed strings (final, verbatim)

| Where | String |
|---|---|
| Permission screen headline (after FIRST encounter close; after the account moment if both trigger) | `the map can call you each morning.` — `serifLarge` (a held thought — the serif doctrine's register c) |
| Time choice, first option above the hour wheel | `at sunrise` |
| Hour wheel default | 8:00 |
| Confirm | `allow` → renders as `linkPrimary` (the component uppercases: `ALLOW →`-style treatment per Slice T §6b, no underline) |
| Dismiss | `not now` → `linkSecondary`, hairline (glyphless — keeps its underline per the one-signifier rule) |
| Settings row (the permanent path — there is NO re-prompt) | `the morning call · set a time` (sunrise appears as a choice alongside hours) |
| iOS location purpose string (`NSLocationWhenInUseUsageDescription`) | `Mineral uses your approximate location only to time the morning call to sunrise.` |

*Doctrine check: the headline is serif (the practice speaking); everything else on the screen — picker labels, buttons — is sans. No serif inside any pressable.*

## 4. Scheduling

On every app foreground/background transition: cancel all scheduled notifications and reschedule the **next 30 days** at the chosen time, body per §1 from the CURRENT pointer (the body naturally changes only when the user completes an encounter and the pointer advances). Someone who stops opening the app stops being called after ~30 days — this is intended behavior, not a bug.

## 5. Sunrise amendment

- If `at sunrise` is chosen, request **coarse/approximate** location permission *at that moment only* (iOS reduced-accuracy tier) — never before, never at install.
- Compute each day's sunrise with the `suncalc` library from the stored coarse coordinates when building the 30-day queue — each day at its own sunrise, **clamped to 05:30–09:00**. If no sunrise exists (polar winter) or location is unavailable, that day falls back to 8:00.
- Store the choice and coordinates **locally only** — add nothing to Firestore.
- If location permission is declined: revert the picker to the hour wheel **without comment** — no error line, no explanation.
- Privacy-label note for the founder (not a code change): Location — coarse, app functionality only, not linked to identity, not used for tracking.

## 6. Acceptance (extends the slice gate)

- [ ] Scheduled queue inspectable in dev: 30 entries, correct times, body matches the Day-1 epigraph exactly (character-for-character, including the final period).
- [ ] No title field on any scheduled notification; `sound: null` verified.
- [ ] Permission screen renders once after first encounter close; declining leaves only the Settings row path; no re-prompt on subsequent closes.
- [ ] Sunrise chosen → location asked at that moment; each of the 30 entries carries its own (drifting) time within 05:30–09:00.
- [ ] Location declined → picker reverts to hour wheel silently.
- [ ] Grep: no exclamation marks, no "streak", no "tap to" in any notification-related string.
