/**
 * Mineral design tokens.
 * All color values are derived from the Mineral design system.
 * Phase I (Signal / Archaic) atmosphere: #C44A8A accent on deep #0a0510 ground.
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#FFFFFF",
    tint: "#C44A8A",

    // App ground
    background: "#0a0510",
    backgroundEnd: "#1a0a18",
    foreground: "#FFFFFF",

    // Surfaces / cards
    card: "rgba(255,255,255,0.05)",
    cardForeground: "#FFFFFF",
    cardBorder: "rgba(255,255,255,0.08)",

    // Primary action — Signal accent
    primary: "#C44A8A",
    primaryForeground: "#FFFFFF",

    // Secondary
    secondary: "rgba(255,255,255,0.08)",
    secondaryForeground: "#FFFFFF",

    // Muted
    muted: "rgba(255,255,255,0.05)",
    mutedForeground: "rgba(255,255,255,0.4)",

    // Accent = Signal
    accent: "#C44A8A",
    accentForeground: "#FFFFFF",

    // Destructive
    destructive: "#ef4444",
    destructiveForeground: "#FFFFFF",

    // Borders / inputs
    border: "rgba(255,255,255,0.08)",
    input: "rgba(255,255,255,0.08)",

    // Text hierarchy — Slice T (AA ruling): 0.5 alpha is the FLOOR;
    // nothing dimmer renders text.
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.72)",
    textTertiary: "rgba(255,255,255,0.58)",
    textMuted: "rgba(255,255,255,0.5)",

    // Accent text-tints — accents-as-text, always alpha 1.0.
    // (#C44A8A is 4.50:1 on the ground — never text below 18px.)
    signalText: "#E08AAF",
    fieldText: "#88DCBA",
    frictionText: "#E9B76B",
    voiceText: "#9BB6D6",
    integralText: "#C4BAEA",

    // Phase accents (all four phases, use Signal for v0.5)
    signal: "#C44A8A",
    field: "#5DCAA5",
    friction: "#D89A3A",
    voice: "#6B8EB8",
    integral: "#A89CDC",

    // Atmosphere glow color for Signal phase
    glowColor: "rgba(196, 74, 138, 0.12)",
  },

  // Border radius
  radius: 12,
};

export default colors;
