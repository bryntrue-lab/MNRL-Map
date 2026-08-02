# Mineral — Slice T: Type Consolidation (Cormorant + the sanctioned scale)

*Self-contained slice. Run as its OWN pass — nothing else rides along. Standing instruction applies: this slice touches type tokens, font loading, and the mechanical migration of text styles; it changes NO layout, logic, navigation, or behavior. Evidence base: the typography audit of 2026-08 (161 styles, 25 sizes, 43 AA contrast failures, 19 unset families, Georgia placeholder). Where this conflicts with older documents, THIS DOCUMENT WINS.*

---

## 0. Decisions already made (do not reopen)

1. **The serif is Cormorant Garamond, italic.** Georgia (the declared v0.5 placeholder) is retired everywhere.
2. Cormorant's small x-height is compensated by scale, not apology: **no serif below 16px, and 16px serif uses the 500 weight.** Serif sizes across the app bump ~1–2px from their Georgia values (the migration map below encodes this).
3. **Alpha floor:** white text never below 0.5 alpha (0.46 is the AA line on the ground; 0.5+ is the rule).
4. **Accents as text are always alpha 1.0.** Signal pink `#C44A8A` (4.50:1 — zero margin) is never used for text below 18px; its text-tint `#E08AAF` is. Every phase accent gets a text-tint token (§3).
5. **Absolute size floor 9px**, used only for the uppercase micro register at weight 600, full alpha.
6. Everything routes through tokens. After this slice, no component declares a raw `fontSize` — only `...TypeScale.x` spreads (color overrides via color tokens are allowed).

## 1. Font loading

Add `@expo-google-fonts/cormorant-garamond`. Load `CormorantGaramond_400Regular_Italic`, `CormorantGaramond_500Medium_Italic`, `CormorantGaramond_600SemiBold_Italic` alongside the existing Inter set in `app/_layout.tsx`. Update `constants/typography.ts`:

```ts
export const FontFamily = {
  sans400: "Inter_400Regular",
  sans500: "Inter_500Medium",
  sans600: "Inter_600SemiBold",
  serifItalic: "CormorantGaramond_400Regular_Italic",
  serifItalicMedium: "CormorantGaramond_500Medium_Italic",
} as const;
// Note: the italic is baked into the family names — remove all `fontStyle: "italic"` declarations app-wide.
```

## 2. The sanctioned scale (replaces TypeScale wholesale)

**Sans — Inter (system/structure):**

| Token | Size | Weight | Tracking | LH | Use |
|---|---|---|---|---|---|
| `display` | 28 | 500 | −0.4 | 30 | page titles ("Seventeen days in") |
| `screenTitle` | 22 | 500 | −0.22 | 26 | screen titles |
| `sectionTitle` | 18 | 500 | 0 | 22 | section heads |
| `body` | 14 | 400 | 0 | 21 | running text (up from 13 — readability ruling) |
| `label` | 12 | 500 | 0.2 | 16 | buttons, inputs, chips |
| `metadata` | 11 | 400 | 0.1 | 15 | attributions, counts, meta rows |
| `eyebrow` | 10 | 600 | 1.8 (UPPERCASE) | 14 | eyebrows (up from 9) |
| `micro` | 9 | 600 | 1.6 (UPPERCASE) | 12 | absolute floor; tab labels, map micro only |

**Serif — Cormorant Garamond italic (the ritual voice):**

| Token | Size | Weight | LH | Use |
|---|---|---|---|---|
| `serifDisplay` | 30 | 500i | 36 | season titles, onboarding questions |
| `serifTitle` | 26 | 500i | 32 | ⟡ questions, HUD station, encounter titles |
| `serifLarge` | 23 | 400i | 30 | epigraph, hold line, close line |
| `serifMedium` | 20 | 400i | 27 | woven line, season question, carry closings, block instructions |
| `serifBody` | 18 | 400i | 25 | counterweight question, guide quotes, feed excerpts |
| `serifSmall` | 16 | **500i** | 21 | subtitles, companion descriptors, promise lines |

No other font sizes may exist in the app after this slice. (The Origin map's SVG text keeps its C.1-tuned pixel sizes — they were set for the map's own geometry — but adopts the Cormorant family for its serif elements and obeys the alpha rules.)

## 3. Color tokens (update `constants/colors.ts` text hierarchy)

```ts
textPrimary:   "#FFFFFF",
textSecondary: "rgba(255,255,255,0.72)",   // was 0.6
textTertiary:  "rgba(255,255,255,0.58)",   // was 0.45
textMuted:     "rgba(255,255,255,0.5)",    // was 0.3 — this is the FLOOR; nothing dimmer renders text
// Accent text-tints (accents-as-text, always alpha 1.0):
signalText:    "#E08AAF",
fieldText:     "#88DCBA",
frictionText:  "#E9B76B",
voiceText:     "#9BB6D6",
integralText:  "#C4BAEA",
```

Migration rule for colors: any text color with alpha < 0.5 maps to the nearest new token (0.3/0.35/0.4/0.45 → `textMuted`; 0.55–0.65 → `textTertiary` or `textSecondary`, nearest). Full-white and ≥ 0.85 alphas may stay as written. Any accent hex used on text at < 1.0 alpha → the accent's text-tint at 1.0. `#C44A8A` on text below 18px → `signalText`.

## 4. Mechanical migration map (old inline size → token)

**Serif (Georgia → Cormorant):** 27–30 → `serifDisplay` · 22–26 → `serifTitle` (epigraph/hold/close lines specifically → `serifLarge`) · 19–21 → `serifMedium` · 16–18 → `serifBody` · ≤ 15.5 → `serifSmall`.
**Sans:** 26–28 → `display` · 20–24 → `screenTitle` · 16–18 → `sectionTitle` · 13–15.5 → `body` · 12–12.5 → `label` · 10.5–11.5 → `metadata` · 9.5–10 uppercase → `eyebrow` · 8–9 → `micro` (or `metadata` if not uppercase — judgment: prefer the larger).
**The 19 unset-family styles:** assign `body`/`metadata`/`label` by size per the sans map — every text style must name a Mineral face.

When a mapping is genuinely ambiguous, choose the LARGER token. Do not preserve odd sizes "to be safe" — the point is convergence.

## 5. Acceptance

- [ ] Grep: zero `"Georgia"` references; zero `fontStyle: "italic"`; zero raw `fontSize:` outside `constants/` (token spreads only).
- [ ] Grep: zero text styles without a `FontFamily`/token reference.
- [ ] Every screen visually checked on device: onboarding, origin (map + sheets + wander), encounter (all seven states), notes, guide, settings — nothing clipped, nothing overlapping (Cormorant runs ~5–8% wider than Georgia at these sizes; the epigraph's two-line max and the CTA pill are the likeliest wrap points).
- [ ] The audit re-run (founder pushes; audit runs externally) shows: ≤ 14 distinct sizes, 0 unset families, 0 AA contrast failures.
- [ ] The ritual lines — epigraph, ⟡ question, woven line, season title — visibly render in Cormorant on device.
