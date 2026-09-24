# Mineral — Slice Q: the ledger finds its structure (Notes at volume)

*Standing instruction applies; CS vocabulary rules standing. Scope: the Notes tab's list presentation only. No data changes, no query changes (order by `createdAt` only — per the QA ruling, the new context fields never enter a query clause), no Guide changes, no search.*

## 0. Design intent

Notes is the ledger; the Guide is the search. At 40+ notes the ledger needs orientation, not retrieval — a reader should be able to find "the day before yesterday" by eye, and see only their dreams when that's the question. Nothing heavier: no search field, no collapse, no archive. If testers later ask for search, that's a finding about the Guide, not a Notes feature request.

## Q1. Day grouping

- The list groups by capture day, newest day first, chronological order within a day unchanged.
- Day header: `metadata` register, lowercase, letter-spacing 1.2, `textMuted` — the quiet sibling of the exemplar meta lines. Values: `today` · `yesterday` · then `september 21` (month + day; add the year only when it isn't the current year).
- Headers are labels, not controls — no tap, no collapse. First header sits flush under the capture chips' section; ≥28pt above each subsequent header.
- Note rows themselves unchanged: two-line truncation, type · relative-time meta, tap opens the note sheet (Slice J).

## Q2. Type filter

- A single quiet row beneath the capture area, above the first day header: the type names in lowercase, `label` register at `textTertiary`, separated by ` · ` — only types that exist in the user's field render (no dead filters).
- Tap a type → the list shows only that type (day headers persist; days with no matches disappear); the active type renders `textPrimary`. Tap it again → back to all. Exactly one active at a time; no "all" chip — the cleared state is all.
- Filtered-to-empty cannot occur (only existing types render), so no empty-state copy is needed.
- The `recent` header and `{n} in your field` line: unchanged if present in the current layout; the filter row must not add visual weight above the fold — if space is tight on small screens, the filter row scrolls with the list rather than pinning.

## Acceptance

- [ ] Founder's 41-note field: grouped by day, `today`/`yesterday`/dated headers correct across a month span; order within days unchanged.
- [ ] Tap `dream` → only dreams, headers thin out correctly; tap again → all notes return.
- [ ] Types absent from the field don't appear in the filter row; capture a first note of a new type → its filter appears.
- [ ] Rows, truncation, tap-to-sheet, and release-a-note all behave exactly as before.
- [ ] Smallest supported iPhone: no layout collision between capture chips, filter row, and first header.
- [ ] File list: the Notes tab component(s) only.

## Out of scope

Search; collapse/expand; pagination changes; any query modification; Guide or capture-sheet changes.
