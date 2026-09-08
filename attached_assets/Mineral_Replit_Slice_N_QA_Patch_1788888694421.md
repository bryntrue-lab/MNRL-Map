# Mineral — Slice N: build-10 QA patch (keep-what-comes input · hero freshness)

*Standing instruction applies. Two fixes, app-side only. Nothing else moves.*

## N1. Keep-what-comes: the input never leaves the screen

Bug: with the sheet expanded and the keyboard up, the text input scrolls out of view — the user types blind. Fix the keyboard-open layout by priority: **the input field and the KEEP THIS → action are anchored visible above the keyboard, always.** The date and question remain above the input; if vertical space runs out, the question may compress or scroll — the input may not. Use the existing keyboard-aware scroll component (`KeyboardAwareScrollViewCompat`) rather than a new mechanism.

Also in the expanded state: the chrome duplicates — two ✕ controls and the header rendered twice (sheet and parent both drawing). Exactly one ✕, one `KEEP WHAT COMES` eyebrow, in the sheet.

Acceptance: open reading sheet → keep what comes → type a multi-line answer with the keyboard up — every character visible as typed; single ✕ reachable; close returns to Origin; verify on the smallest supported iPhone.

## N2. The RETURNING hero follows the freshest return

Today the hero is effectively the all-time max-count motif — it has shown `support` for weeks while the field moved on. Amend the hero selection (supersedes the count-first ordering for the HERO ONLY; the rest of the Guide's ordering is unchanged):

- Among established returning motifs (existing threshold rules unchanged), the hero is the one whose **most recent contributing note is newest**. Tie-break: higher count, then the existing phrase > lexicon > word precedence.
- The hero's exemplar remains the freshest exemplar of that motif (unchanged rule).
- Result to verify: a field active in `flow`/`body` this week leads with one of those, not a three-week-old `support` cluster; capture a new note carrying a different established motif → the hero follows it on next Guide load.

Acceptance: founder's real field shows a hero from the last few days, not `support`; the count phrase and `all {n} notes →` whisper still correct; no change to GATHERING / ARRIVING / lens rows.

File list: the sheet component + guide hero selection. Nothing else.
