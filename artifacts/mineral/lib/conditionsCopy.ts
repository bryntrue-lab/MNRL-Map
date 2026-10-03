// Founder source: attached_assets/Conditions_Copy_Matrix_1791061316554.md.
// Hour copy only. Gap copy and evidence thresholds are deliberately unchanged.
type Cell = { line: string; evidence: string };
const lines: Record<string, string[]> = {
  dream: ["the dreams surface in the morning", "the dreams surface at midday", "the dreams surface in the evening", "the dreams surface at night"],
  spark: ["sparks arrive in the morning", "sparks arrive at midday", "sparks arrive in the evening", "sparks arrive at night"],
  resistance: ["resistance arrives in the morning", "resistance arrives at midday", "resistance arrives in the evening", "resistance arrives at night"],
  symbol: ["the symbols show themselves in the morning", "the symbols show themselves at midday", "the symbols show themselves in the evening", "the symbols show themselves at night"],
  synchronicity: ["synchronicity finds you in the morning", "synchronicity finds you at midday", "synchronicity finds you in the evening", "synchronicity finds you at night"],
  vision: ["the visions open in the morning", "the visions open at midday", "the visions open in the evening", "the visions open at night"],
  desire: ["desire speaks in the morning", "desire speaks at midday", "desire speaks in the evening", "desire speaks at night"],
  fear: ["fear visits in the morning", "fear visits at midday", "fear visits in the evening", "fear visits at night"],
  reflection: ["reflection belongs to your mornings", "reflection belongs to the middle of your day", "reflection belongs to your evenings", "reflection belongs to your nights"],
};
const nouns: Record<string, string> = {
  dream: " dreams", spark: " sparks", resistance: " walls", symbol: " symbols",
  synchronicity: "", vision: " visions", desire: "", fear: "", reflection: "",
};
const buckets = ["morning", "midday", "evening", "night"];
const qualifiers = ["before ten", "between ten and five", "after five", "after nine"];

// Build the type → bucket → {line, evidence} table from the approved literals.
const matrix: Record<string, Record<string, Cell>> = Object.fromEntries(
  Object.entries(lines).map(([type, entries]) => [
    type,
    Object.fromEntries(buckets.map((bucket, i) => [
      bucket,
      {
        line: entries[i],
        evidence: `{m} of {t}${nouns[type]} · ${
          type === "resistance" && bucket === "night" ? "named after nine" : qualifiers[i]
        }`,
      },
    ])),
  ]),
);

export function hourConditionCopy(
  type: string, bucket: string, matching: string, total: string,
): Cell | null {
  if (!Object.hasOwn(matrix, type) || !Object.hasOwn(matrix[type], bucket)) return null;
  const cell = matrix[type][bucket];
  return {
    line: cell.line,
    evidence: cell.evidence.replace("{m}", matching).replace("{t}", total),
  };
}