/**
 * Mineral — Guide-side text helpers (Task D, Slice D.2).
 *
 * A faithful client mirror of the engine's normalization
 * (functions/patternEngine.js): same stopword list, same light stemmer.
 * Used ONLY to compute TODAY'S ARRIVALS — the content words that appeared
 * for the first time in today's notes — verbatim, lowercase.
 *
 * The Guide never interprets. This module counts and echoes.
 */

const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are arent as at be " +
    "because been before being below between both but by cant cannot could " +
    "couldnt did didnt do does doesnt doing dont down during each few for " +
    "from further had hadnt has hasnt have havent having he hed hell hes her " +
    "here heres hers herself him himself his how hows i id ill im ive if in " +
    "into is isnt it its itself lets me more most mustnt my myself no nor " +
    "not of off on once only or other ought our ours ourselves out over own " +
    "same shant she shed shell shes should shouldnt so some such than that " +
    "thats the their theirs them themselves then there theres these they " +
    "theyd theyll theyre theyve this those through to too under until up " +
    "very was wasnt we wed well were weve werent what whats when whens where " +
    "wheres which while who whos whom why whys with wont would wouldnt you " +
    "youd youll youre youve your yours yourself yourselves " +
    "just really quite kind sort like also even still yet ever never always " +
    "maybe perhaps around going got get gets getting went gone came come " +
    "comes coming say says said saying see sees seeing seen saw know knows " +
    "knowing knew known think thinks thinking thought want wants wanting " +
    "wanted make makes making made much many lot bit thing things something " +
    "anything everything nothing someone anyone everyone one two today " +
    "yesterday tomorrow now then again back way ways time times day days " +
    "keep keeps keeping kept feel feels feeling felt little big right left " +
    "first last next new old good bad yes okay ok oh um uh hmm"
  )
    .split(/\s+/)
    .filter(Boolean)
);

export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) {
    w = w.slice(0, -3);
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }
  if (w.length > 4 && w.endsWith("ed")) {
    w = w.slice(0, -2);
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Content words of a text: [{ raw, stem }], stopwords removed. */
export function contentWords(text: string): { raw: string; stem: string }[] {
  return normalize(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, stem: stem(raw) }))
    .filter(
      (t) => !STOPWORDS.has(t.raw) && !STOPWORDS.has(t.stem) && t.raw.length >= 2
    );
}

/**
 * TODAY'S ARRIVALS — content words whose FIRST occurrence across the whole
 * field is in today's notes. Verbatim (raw, lowercase), most recent first,
 * capped at 7 — anything beyond drops silently.
 */
export function todaysArrivals(
  notes: { content?: string | null; createdAt?: { toDate?: () => Date } }[]
): string[] {
  const today = new Date().toDateString();
  // earliest occurrence day per stem
  const earliest = new Map<string, string>();
  const dated = notes
    .map((n) => ({
      content: n.content,
      date: n.createdAt?.toDate?.() ?? null,
    }))
    .filter((n) => n.content && n.date) as { content: string; date: Date }[];

  // oldest → newest so the first write into the map IS the first occurrence
  const asc = [...dated].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const n of asc) {
    for (const w of contentWords(n.content)) {
      if (!earliest.has(w.stem)) earliest.set(w.stem, n.date.toDateString());
    }
  }

  // walk today's notes newest-first; collect raws whose stem arrived today
  const seen = new Set<string>();
  const arrivals: string[] = [];
  const desc = [...dated].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const n of desc) {
    if (n.date.toDateString() !== today) continue;
    for (const w of contentWords(n.content)) {
      if (earliest.get(w.stem) === today && !seen.has(w.stem)) {
        seen.add(w.stem);
        arrivals.push(w.raw);
        if (arrivals.length >= 7) return arrivals;
      }
    }
  }
  return arrivals;
}

/** Numbers under ten spelled out (synthesis sentences); numerals above. */
export function spellOut(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four",
    "five", "six", "seven", "eight", "nine",
  ];
  return n >= 0 && n < 10 ? words[n] : String(n);
}
