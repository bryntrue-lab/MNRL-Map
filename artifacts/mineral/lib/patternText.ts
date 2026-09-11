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
    "first last next new old good bad yes okay ok oh um uh hmm " +
    // D.3d §3.1 — modal/auxiliary verbs
    "can could would should will shall may might must " +
    // Slice K — mirror the server's conversational filler filter exactly.
    "though exactly sure actually almost along already another anyway rather especially"
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
 * ARRIVING TODAY — content words whose FIRST occurrence across the whole
 * field is in today's notes. Verbatim (raw, lowercase), most recent first,
 * capped at 7 — anything beyond drops silently. Each carries its in-day
 * occurrence count (D.3d §1f).
 */
export type Arrival = { word: string; count: number };

export function todaysArrivals(
  notes: { content?: string | null; createdAt?: { toDate?: () => Date } }[]
): Arrival[] {
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

  // in-day occurrence count per stem, across ALL of today's notes
  const dayCounts = new Map<string, number>();
  for (const n of dated) {
    if (n.date.toDateString() !== today) continue;
    for (const w of contentWords(n.content)) {
      dayCounts.set(w.stem, (dayCounts.get(w.stem) ?? 0) + 1);
    }
  }

  // walk today's notes newest-first; collect raws whose stem arrived today
  const seen = new Set<string>();
  const arrivals: Arrival[] = [];
  const desc = [...dated].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const n of desc) {
    if (n.date.toDateString() !== today) continue;
    for (const w of contentWords(n.content)) {
      if (earliest.get(w.stem) === today && !seen.has(w.stem)) {
        seen.add(w.stem);
        arrivals.push({ word: w.raw, count: dayCounts.get(w.stem) ?? 1 });
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

/** Full spelling to ninety-nine for sentence/field-line prose
 *  (the D.3 prototype spells "thirty-one notes", "twenty-three days"). */
export function spellNumber(n: number): string {
  if (n < 10) return spellOut(n);
  const teens = [
    "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  ];
  if (n < 20) return teens[n - 10];
  const tens = [
    "", "", "twenty", "thirty", "forty",
    "fifty", "sixty", "seventy", "eighty", "ninety",
  ];
  if (n < 100) {
    const t = tens[Math.floor(n / 10)];
    const r = n % 10;
    return r === 0 ? t : `${t}-${spellOut(r)}`;
  }
  return String(n);
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/** Engine key mirror: stopwords pass through raw; content words stem. */
export function stemToken(raw: string): string {
  return STOPWORDS.has(raw) ? raw : stem(raw);
}

/** Full token stream (stopwords retained) as [raw, keyStem] — mirror of
 *  the engine's tokenize, for highlighting item runs inside exemplars. */
export function tokenStream(text: string): { raw: string; stem: string }[] {
  return normalize(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, stem: stemToken(raw) }));
}

/**
 * DISPLAY TRIM (D.3d §3.3): the trim list is connectives-only — strip
 * TRAILING connectives from a rendered item; never leading, never
 * interior ("this work is important to me" renders in full). The stored
 * key stays untrimmed.
 */
const TRIM_WORDS = new Set([
  "and", "but", "or", "so", "the", "a", "an", "of", "that", "with",
]);

export function displayItem(key: string): string {
  const words = key.split(" ");
  let end = words.length;
  while (end > 1 && TRIM_WORDS.has(words[end - 1])) end -= 1;
  return words.slice(0, end).join(" ");
}

const sameSet = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a || !b || a.length < 2 || a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
};

/**
 * Display-side defensive suppression (D.3 addendum):
 * — drop phrase A when A is a contiguous sub-sequence of phrase B with an
 *   identical note set;
 * — drop a WORD whose note set equals that of a phrase containing it
 *   (the word stays counted in the doc; only its display is suppressed).
 * `itemNotes` maps item → contributing note ids.
 */
export function suppressForDisplay<T extends { key: string }>(
  items: T[],
  itemNotes: Record<string, string[] | undefined>
): T[] {
  const contiguous = (a: string[], b: string[]) => {
    outer: for (let i = 0; i + a.length <= b.length; i++) {
      for (let j = 0; j < a.length; j++) {
        if (b[i + j] !== a[j]) continue outer;
      }
      return true;
    }
    return false;
  };
  const phrases = items.filter((it) => it.key.includes(" "));
  return items.filter((it) => {
    const w = it.key.split(" ");
    for (const p of phrases) {
      if (p.key === it.key) continue;
      const pw = p.key.split(" ");
      if (pw.length <= w.length) continue;
      if (contiguous(w, pw) && sameSet(itemNotes[it.key], itemNotes[p.key])) {
        return false;
      }
    }
    return true;
  });
}
