/**
 * Mineral typography tokens — Slice T (type consolidation, 2026-08).
 * Two registers:
 *   sans  — Inter, the system/structure voice
 *   serif — Cormorant Garamond ITALIC, the ritual voice (italic is baked
 *           into the family names; never declare fontStyle: "italic").
 * Rules encoded here (do not reopen):
 *   · no serif below 16px; 16px serif uses the 500 weight
 *   · absolute size floor 9px (uppercase micro register, weight 600 only)
 *   · every text style routes through these tokens — no raw fontSize
 *     outside constants/.
 */

export const FontFamily = {
  sans400: "Inter_400Regular",
  sans500: "Inter_500Medium",
  sans600: "Inter_600SemiBold",
  serifItalic: "CormorantGaramond_400Regular_Italic",
  serifItalicMedium: "CormorantGaramond_500Medium_Italic",
} as const;

export const TypeScale = {
  // ── Sans — Inter (system/structure) ─────────────────────────
  // Page titles ("Seventeen days in")
  display: {
    fontFamily: FontFamily.sans500,
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  // Screen titles
  screenTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 22,
    letterSpacing: -0.22,
    lineHeight: 26,
  },
  // Section heads
  sectionTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 18,
    letterSpacing: 0,
    lineHeight: 22,
  },
  // Running text (14 — readability ruling)
  body: {
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 21,
  },
  // Buttons, inputs, chips
  label: {
    fontFamily: FontFamily.sans500,
    fontSize: 12,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  // Attributions, counts, meta rows
  metadata: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 0.1,
    lineHeight: 15,
  },
  // Eyebrows (uppercase)
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    lineHeight: 14,
  },
  // Absolute floor — tab labels, map micro only (uppercase)
  micro: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    lineHeight: 12,
  },

  // ── Serif — Cormorant Garamond italic (the ritual voice) ────
  // Season titles, onboarding questions
  serifDisplay: {
    fontFamily: FontFamily.serifItalicMedium,
    fontSize: 30,
    lineHeight: 36,
  },
  // ⟡ questions, HUD station, encounter titles
  serifTitle: {
    fontFamily: FontFamily.serifItalicMedium,
    fontSize: 26,
    lineHeight: 32,
  },
  // Epigraph, hold line, close line
  serifLarge: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 23,
    lineHeight: 30,
  },
  // Woven line, season question, carry closings, block instructions
  serifMedium: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 20,
    lineHeight: 27,
  },
  // Counterweight question, guide quotes, feed excerpts
  serifBody: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 18,
    lineHeight: 25,
  },
  // Subtitles, companion descriptors, promise lines — the serif floor,
  // weight 500 to hold Cormorant's small x-height at this size.
  serifSmall: {
    fontFamily: FontFamily.serifItalicMedium,
    fontSize: 16,
    lineHeight: 21,
  },
} as const;
