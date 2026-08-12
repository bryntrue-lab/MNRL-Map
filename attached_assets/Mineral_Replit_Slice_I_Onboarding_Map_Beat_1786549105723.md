# Mineral — Slice I: The Map Beat (onboarding stickiness)

*Micro-slice, view + copy only. Standing instruction applies. Intent: onboarding currently shows the map being drawn but never lets the hands touch it — this slice adds ONE held interactive beat so the first thing a user ever does with the map is wander their own life. No new screens; no tutorial chrome.*

## I1. The choreography ends in an open hand

Today the first-run choreography completes and onboarding advances. Change: when the drawing finishes and the needle settles on today, the sequence HOLDS on the live map:

1. Caption fades in above the map (`serifLarge`): **`you are here.`** — with the meta line beneath it (`metadata`): current month/year · age, as the wander caption renders them.
2. Two seconds later, a whisper fades in below (`linkWhisper`): **`drag anywhere — the map answers →`**
3. The map is LIVE in wander mode (the full existing behavior: labels rise, needle swings, stations lead). The user's first drag dismisses the whisper; the caption behaves as the normal wander caption from then on.
4. A quiet `continue →` (`linkPrimary`, bottom) advances to the practice screen — present from the start of the hold, so nobody is trapped; the skip affordance for the whole choreography is unchanged.
5. First-run only. Ordinary Origin visits are untouched.

## I2. One connecting line on the practice screen

The practice screen gains one line beneath its existing copy (`bodyLarge`, `textSecondary`), final verbatim:

**`one encounter keeps each morning. the map holds all of it — wander whenever you want.`**

*(This is the only copy that ties the two surfaces together in onboarding; it earns its place by pointing at what the user just did with their hands.)*

## I3. Nothing else

No changes to the six-step structure, the signature payoff, the begin card, or the first-run hint on Origin (`touch the map to read the season` still appears once on the first ordinary visit — it now lands on someone who has already wandered, which is the right order: do, then name).

## Acceptance

- [ ] Fresh install: choreography completes → map holds live with `you are here.` + whisper → drag works with full wander behavior → `continue →` advances. Skip path unchanged.
- [ ] The whisper never reappears (first-run only); ordinary Origin visits identical to today.
- [ ] Practice screen shows the I2 line verbatim.
- [ ] File list in checkpoint summary; nothing outside the choreography end-state and the practice screen line.
