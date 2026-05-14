/**
 * Mineral typography tokens.
 * Two registers: sans (Inter) for system/structure, serif (Georgia italic) for the poetic.
 * Matches the Mineral design system type scale.
 */

export const FontFamily = {
  sans400: "Inter_400Regular",
  sans500: "Inter_500Medium",
  sans600: "Inter_600SemiBold",
  serifItalic: "Georgia", // system fallback for v0.5; proper webfont in v1
} as const;

export const TypeScale = {
  // Display / page title: 28px sans 500, ls -0.015em, lh 1.05
  display: {
    fontFamily: FontFamily.sans500,
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  // Screen title: 22px sans 500, ls -0.01em, lh 1.1
  screenTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 22,
    letterSpacing: -0.22,
    lineHeight: 24,
  },
  // Section title: 18px sans 500
  sectionTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 18,
    letterSpacing: 0,
    lineHeight: 22,
  },
  // Serif large / questions: 22px serif italic, lh 1.25
  serifLarge: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic" as const,
    fontSize: 22,
    lineHeight: 27,
  },
  // Serif medium / subtitles: 14px serif italic, muted
  serifMedium: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic" as const,
    fontSize: 14,
    lineHeight: 18,
  },
  // Body: 13px sans 400, lh 1.5
  body: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    lineHeight: 20,
  },
  // Eyebrow: 9px sans 600 uppercase 0.22em
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 9,
    letterSpacing: 2.0,
    textTransform: "uppercase" as const,
    lineHeight: 12,
  },
  // Metadata: 11px sans 400 muted
  metadata: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    lineHeight: 14,
  },
} as const;
