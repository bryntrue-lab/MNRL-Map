import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import TabTopBar from "@/components/TabTopBar";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { db, functions } from "@/lib/firebase";
import { fieldNotesQuery, type FieldNoteWithId } from "@/lib/firestore";
import {
  contentWords,
  displayItem,
  spellNumber,
  suppressForDisplay,
  todaysArrivals,
  tokenStream,
} from "@/lib/patternText";
import type {
  ExemplarEntry,
  FieldNoteDoc,
  PatternDoc,
  PatternType,
} from "@/types/firestore";

// Slice D.3 §B — the Guide speaks first. The engine counts; the Guide
// echoes counts and quotes verbatim. Tier language fixed: entered your
// field · has appeared twice · appears in N of your notes.

const LENSES: {
  id: string;
  pattern: PatternType | null;
  label: string;
  color: string;
}[] = [
  { id: "resistance",    pattern: "resistance", label: "recurring resistance",    color: "#e08aaf" },
  { id: "threads",       pattern: "thread",     label: "your recurring language", color: "#88dcba" },
  { id: "motifs",        pattern: "motif",      label: "mythic motifs",           color: "#e9b76b" },
  { id: "conditions",    pattern: null,         label: "conditions",              color: "#9bb6d6" },
  { id: "consciousness", pattern: null,         label: "consciousness",           color: "#c4baea" },
];

const SOURCE_LABEL: Record<string, string> = {
  encounter: "the threshold",
  spontaneous: "the field",
};

const SEEN_COMPLETIONS_KEY = "mineral_guide_seen_completions";

/** Attribution: `type · source · relative time` — everywhere, verbatim. */
export function attribution(e: ExemplarEntry): string {
  const parts: string[] = [];
  if (e.noteType) parts.push(e.noteType);
  if (e.source) parts.push(SOURCE_LABEL[e.source] ?? e.source);
  const captured = e.capturedAt?.toDate?.();
  if (captured) {
    const days = Math.floor((Date.now() - captured.getTime()) / 86400000);
    parts.push(days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
  }
  return parts.join(" · ");
}

type Patterns = Partial<Record<PatternType, PatternDoc>>;

type PoolItem = {
  key: string;
  count: number;
  type: PatternType;
  lexicon: boolean; // motif/resistance (lexicon-matched)
  phrase: boolean;
  latestMs: number;
  noteIds: string[];
};

/** All counted items pooled across docs; a key present in both thread and
 *  a lexicon doc keeps the lexicon entry (richer — can carry an offering). */
function poolItems(patterns: Patterns): PoolItem[] {
  const byKey = new Map<string, PoolItem>();
  for (const type of ["thread", "motif", "resistance"] as PatternType[]) {
    const doc = patterns[type];
    if (!doc) continue;
    for (const [key, count] of Object.entries(doc.itemCounts ?? {})) {
      const exemplars = doc.exemplars?.[key] ?? [];
      const latestMs = exemplars.length
        ? Math.max(...exemplars.map((e) => e.capturedAt?.toMillis?.() ?? 0))
        : 0;
      const item: PoolItem = {
        key,
        count,
        type,
        lexicon: type !== "thread",
        phrase: key.includes(" "),
        latestMs,
        noteIds: doc.itemNotes?.[key] ?? [],
      };
      const existing = byKey.get(key);
      if (!existing || (item.lexicon && !existing.lexicon)) byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/** Hero/synthesis ordering (D.3 addendum): phrases > lexicon-matched >
 *  plain words, then higher count, then most recent occurrence. */
function heroOrder(a: PoolItem, b: PoolItem): number {
  const rank = (i: PoolItem) => (i.phrase ? 2 : i.lexicon ? 1 : 0);
  return rank(b) - rank(a) || b.count - a.count || b.latestMs - a.latestMs;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Age phrase for a span of days: one day · N days · N weeks. */
function spanPhrase(days: number): string {
  if (days <= 1) return "one day";
  if (days < 14) return `${spellNumber(days)} days`;
  return `${spellNumber(Math.round(days / 7))} weeks`;
}

/** Verbatim exemplar text with the item's occurrences at full white. */
function HighlightedQuote({
  text,
  itemKey,
  style,
}: {
  text: string;
  itemKey: string;
  style?: object;
}) {
  const segments = useMemo(() => {
    const keyStems = itemKey.split(" ");
    // walk the raw text word-by-word, marking stem-run matches
    const words = text.split(/(\s+)/);
    const stems = words.map((w) =>
      /\S/.test(w) ? (tokenStream(w)[0]?.stem ?? "") : ""
    );
    const hot = new Array(words.length).fill(false);
    const wordIdx = words
      .map((w, i) => (/\S/.test(w) ? i : -1))
      .filter((i) => i >= 0);
    for (let s = 0; s + keyStems.length <= wordIdx.length; s++) {
      let ok = true;
      for (let j = 0; j < keyStems.length; j++) {
        if (stems[wordIdx[s + j]] !== keyStems[j]) { ok = false; break; }
      }
      if (ok) for (let j = 0; j < keyStems.length; j++) hot[wordIdx[s + j]] = true;
    }
    return words.map((w, i) => ({ w, hot: hot[i] }));
  }, [text, itemKey]);

  return (
    <Text style={style}>
      “
      {segments.map((s, i) =>
        s.hot ? (
          <Text key={i} style={styles.quoteHot}>{s.w}</Text>
        ) : (
          <Text key={i}>{s.w}</Text>
        )
      )}
      ”
    </Text>
  );
}

let selfHealAttempted = false; // once per app session

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [notes, setNotes] = useState<FieldNoteWithId[]>([]);
  const [patterns, setPatterns] = useState<Patterns>({});
  const [patternsLoaded, setPatternsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotes([]);
      setPatterns({});
      return;
    }
    const unsubNotes = onSnapshot(
      fieldNotesQuery(user.uid),
      (snap) =>
        setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as FieldNoteDoc) }))),
      (err) => console.warn("guide notes", err)
    );
    const unsubPatterns = onSnapshot(
      collection(db, "users", user.uid, "patterns"),
      (snap) => {
        const next: Patterns = {};
        snap.docs.forEach((d) => {
          next[d.id as PatternType] = d.data() as PatternDoc;
        });
        setPatterns(next);
        setPatternsLoaded(true);
      },
      (err) => console.warn("guide patterns", err)
    );
    return () => {
      unsubNotes();
      unsubPatterns();
    };
  }, [user]);

  // ── Self-heal (D.3 Part A gate): if any content-ready note is missing
  //    from every ledger, run the backfill callable once per session. ──
  useEffect(() => {
    if (selfHealAttempted || !user || !patternsLoaded || notes.length === 0) return;
    const ledgered = new Set<string>();
    for (const doc of Object.values(patterns)) {
      for (const id of doc?.processed ?? []) ledgered.add(id);
    }
    const missing = notes.some(
      (n) =>
        !!n.content &&
        n.transcriptStatus !== "pending" &&
        !ledgered.has(n.id)
    );
    if (!missing) return;
    selfHealAttempted = true;
    httpsCallable(functions, "backfillPatterns")({}).catch((err) =>
      console.warn("backfillPatterns", err)
    );
  }, [user, notes, patterns, patternsLoaded]);

  // ── Field arithmetic ─────────────────────────────────────────────
  const hasField = notes.length > 0;
  const noteDates = notes
    .map((n) => n.createdAt?.toDate?.())
    .filter(Boolean) as Date[];
  const dayCount = new Set(noteDates.map((d) => d.toDateString())).size;
  const fieldAgeDays = noteDates.length
    ? Math.floor(
        (Date.now() - Math.min(...noteDates.map((d) => d.getTime()))) / 86400000
      ) + 1
    : 0;

  const arrivals = useMemo(() => todaysArrivals(notes), [notes]);

  // ── Pooled, display-suppressed items ─────────────────────────────
  const visibleItems = useMemo(() => {
    const pooled = poolItems(patterns);
    const itemNotes: Record<string, string[] | undefined> = {};
    for (const it of pooled) itemNotes[it.key] = it.noteIds;
    return suppressForDisplay(pooled, itemNotes);
  }, [patterns]);

  const established = useMemo(
    () => visibleItems.filter((i) => i.count >= 3).sort(heroOrder),
    [visibleItems]
  );
  const gathering = useMemo(
    () => visibleItems.filter((i) => i.count === 2).sort(heroOrder),
    [visibleItems]
  );

  // ── The hero: strongest current pattern — every-time guarantee ───
  const hero: PoolItem | null = useMemo(() => {
    if (established.length > 0) return established[0];
    if (gathering.length > 0) return gathering[0];
    if (arrivals.length > 0) {
      const stemKey = contentWords(arrivals[0])[0]?.stem ?? arrivals[0];
      const pooled = visibleItems.find((i) => i.key === stemKey);
      return (
        pooled ?? {
          key: stemKey,
          count: 1,
          type: "thread",
          lexicon: false,
          phrase: false,
          latestMs: Date.now(),
          noteIds: [],
        }
      );
    }
    return null;
  }, [established, gathering, arrivals, visibleItems]);

  const heroExemplars: ExemplarEntry[] = useMemo(() => {
    if (!hero) return [];
    const list = patterns[hero.type]?.exemplars?.[hero.key] ?? [];
    return [...list].sort(
      (a, b) => (a.capturedAt?.toMillis?.() ?? 0) - (b.capturedAt?.toMillis?.() ?? 0)
    );
  }, [hero, patterns]);
  const freshestId = heroExemplars[heroExemplars.length - 1]?.fieldNoteId;
  const heroOffering = hero ? patterns[hero.type]?.offerings?.[hero.key] : null;

  const heroSpan = useMemo(() => {
    if (!hero) return "";
    const times = hero.noteIds
      .map((id) => notes.find((n) => n.id === id)?.createdAt?.toDate?.()?.getTime())
      .filter(Boolean) as number[];
    const pool = times.length
      ? times
      : heroExemplars.map((e) => e.capturedAt?.toMillis?.() ?? 0).filter(Boolean);
    if (pool.length === 0) return "one day";
    const days = Math.floor((Math.max(...pool) - Math.min(...pool)) / 86400000) + 1;
    return spanPhrase(days);
  }, [hero, notes, heroExemplars]);

  // ── Synthesis — precedence unchanged (D.2), item re-typeset ──────
  const synthesis = useMemo((): { pre: string; item: string; post: string } => {
    if (established.length > 0 && notes.length > 0) {
      const it = established[0];
      return {
        pre: "",
        item: cap(displayItem(it.key)),
        post: ` appears in ${spellNumber(it.count)} of your ${spellNumber(
          notes.length
        )} notes.`,
      };
    }
    if (gathering.length > 0) {
      return {
        pre: "",
        item: cap(displayItem(gathering[0].key)),
        post: " has appeared twice.",
      };
    }
    if (arrivals.length > 0) {
      const n = arrivals.length;
      return {
        pre: "",
        item: "",
        post: `${cap(spellNumber(n))} ${n === 1 ? "word" : "words"} entered your field today.`,
      };
    }
    return {
      pre: "",
      item: "",
      post: `${cap(spellNumber(notes.length))} ${
        notes.length === 1 ? "note" : "notes"
      } across ${spellNumber(dayCount)} ${dayCount === 1 ? "day" : "days"}.`,
    };
  }, [established, gathering, arrivals, notes.length, dayCount]);

  // ── GATHERING rows (hero excluded — it is already staged above) ──
  const gatheringRows = useMemo(
    () =>
      gathering
        .filter((i) => i.key !== hero?.key)
        .sort((a, b) => Number(b.phrase) - Number(a.phrase) || heroOrder(a, b)),
    [gathering, hero]
  );

  // ── Post-encounter freshness moment — once per completion ────────
  const eyebrowAnim = useRef(new Animated.Value(1)).current;
  const synthesisAnim = useRef(new Animated.Value(1)).current;
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const [freshMoment, setFreshMoment] = useState(false);
  const completions = profile?.completedEncounterCount ?? null;

  useEffect(() => {
    if (completions === null) return;
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem(SEEN_COMPLETIONS_KEY);
      if (cancelled) return;
      if (raw === null) {
        await AsyncStorage.setItem(SEEN_COMPLETIONS_KEY, String(completions));
        return;
      }
      if (completions > Number(raw)) {
        await AsyncStorage.setItem(SEEN_COMPLETIONS_KEY, String(completions));
        if (cancelled) return;
        setFreshMoment(true);
        eyebrowAnim.setValue(0);
        synthesisAnim.setValue(0);
        underlineAnim.setValue(0);
        Animated.sequence([
          Animated.timing(eyebrowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(eyebrowAnim, { toValue: 0.55, duration: 220, useNativeDriver: false }),
          Animated.timing(eyebrowAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
        ]).start();
        Animated.timing(synthesisAnim, {
          toValue: 1,
          duration: 500,
          delay: 600,
          useNativeDriver: false,
        }).start();
        Animated.timing(underlineAnim, {
          toValue: 1,
          duration: 700,
          delay: 1100,
          useNativeDriver: false,
        }).start();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completions, eyebrowAnim, synthesisAnim, underlineAnim]);

  // ── Lens rows — live only, specific status lines ─────────────────
  const resistanceNotes = notes.filter((n) => n.type === "resistance");

  function lensStatus(lensId: string): { parts: React.ReactNode; live: boolean } {
    if (lensId === "threads") {
      const threadItems = visibleItems.filter((i) => i.type === "thread");
      const estP = threadItems.filter((i) => i.count >= 3 && i.phrase).length;
      const estW = threadItems.filter((i) => i.count >= 3 && !i.phrase).length;
      const gatP = threadItems.filter((i) => i.count === 2 && i.phrase).length;
      const gatW = threadItems.filter((i) => i.count === 2 && !i.phrase).length;
      const pieces: string[] = [];
      if (estP) pieces.push(`${spellNumber(estP)} ${estP === 1 ? "phrase" : "phrases"} established`);
      if (estW) pieces.push(`${spellNumber(estW)} ${estW === 1 ? "word" : "words"} established`);
      if (gatP) pieces.push(`${spellNumber(gatP)} ${gatP === 1 ? "phrase" : "phrases"} gathering`);
      if (gatW) pieces.push(`${spellNumber(gatW)} ${gatW === 1 ? "word" : "words"} gathering`);
      if (pieces.length === 0) return { parts: null, live: false };
      return { parts: <Text style={styles.lensLive}>{pieces.join(" · ")}</Text>, live: true };
    }
    if (lensId === "motifs") {
      const items = visibleItems
        .filter((i) => i.type === "motif")
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      if (items.length === 0) return { parts: null, live: false };
      return {
        parts: (
          <Text style={styles.lensLive}>
            {items.map((it, i) => (
              <Text key={it.key}>
                {i > 0 && " · "}
                <Text style={styles.lensLiveItem}>{displayItem(it.key)}</Text>
              </Text>
            ))}
          </Text>
        ),
        live: true,
      };
    }
    if (lensId === "resistance") {
      const items = visibleItems
        .filter((i) => i.type === "resistance")
        .sort((a, b) => b.count - a.count);
      if (items.length > 0) {
        const top = items[0];
        const lead =
          top.count >= 2
            ? `the same wall, ${spellNumber(top.count)} times — `
            : "one wall named — ";
        return {
          parts: (
            <Text style={styles.lensLive}>
              {lead}
              <Text style={styles.lensLiveItem}>{displayItem(top.key)}</Text>
            </Text>
          ),
          live: true,
        };
      }
      if (resistanceNotes.length > 0) {
        const latest = resistanceNotes[0];
        const words = latest.content ? contentWords(latest.content) : [];
        const named = words.length ? words[words.length - 1].stem : null;
        const n = resistanceNotes.length;
        return {
          parts: (
            <Text style={styles.lensLive}>
              {n === 1 ? "one wall named" : `${spellNumber(n)} walls named`}
              {named ? " — " : ""}
              {named ? <Text style={styles.lensLiveItem}>{named}</Text> : null}
            </Text>
          ),
          live: true,
        };
      }
      return { parts: null, live: false };
    }
    return { parts: null, live: false };
  }

  const lensRows = LENSES.map((l) => ({ lens: l, status: lensStatus(l.id) }));
  const liveRows = lensRows.filter((r) => r.status.live);
  const quietRows = lensRows.filter((r) => !r.status.live);

  // ── The field — the signature ────────────────────────────────────
  const signature = useMemo(() => {
    const byType = new Map<string, number>();
    for (const n of notes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    return [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, c]) => `${spellNumber(c)} ${type}${c === 1 ? "" : "s"}`)
      .join(" · ");
  }, [notes]);

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* B1 — header + field line */}
        <TabTopBar title="FIELD GUIDE" rightIcon="⌕" />
        {hasField && (
          <Text style={styles.fieldLine} testID="guide-field-line">
            {spellNumber(notes.length)} {notes.length === 1 ? "note" : "notes"} ·{" "}
            {fieldAgeDays <= 7 ? "the first week" : `${spellNumber(fieldAgeDays)} days`}
          </Text>
        )}

        {/* B2 — synthesis, re-typeset; taking-root moment unchanged */}
        {hasField ? (
          <View style={styles.synthesisWrap}>
            <Animated.Text
              style={[styles.eyebrow, freshMoment && { opacity: eyebrowAnim }]}
            >
              ● TAKING ROOT
            </Animated.Text>
            <Animated.Text
              style={[styles.synthesis, freshMoment && { opacity: synthesisAnim }]}
              testID="guide-synthesis"
            >
              {synthesis.item !== "" && (
                <Text style={styles.synthesisItem}>{synthesis.item}</Text>
              )}
              {synthesis.post}
            </Animated.Text>
          </View>
        ) : (
          <View style={styles.synthesisWrap}>
            <Text style={styles.eyebrow}>● TAKING ROOT</Text>
            <Text style={styles.emptySynthesis}>
              Your field begins with your first reflection. Patterns emerge with time
              and return.
            </Text>
          </View>
        )}

        {/* B3 — returning: the hero */}
        {hero && (
          <View testID="returning-hero">
            <Text style={styles.sectionHead}>returning</Text>
            <Text style={styles.heroWord} testID="hero-item">
              {displayItem(hero.key)}
            </Text>
            <Text style={styles.heroCount}>
              {hero.count} {hero.count === 1 ? "note" : "notes"} · {heroSpan}
            </Text>

            {heroExemplars.map((e, i) => (
              <View key={`${e.fieldNoteId}-${i}`} style={styles.exemplarBlock}>
                <View style={styles.quoteWrap}>
                  <HighlightedQuote
                    text={e.text}
                    itemKey={hero.key}
                    style={styles.quote}
                  />
                  {freshMoment && e.fieldNoteId === freshestId && (
                    <Animated.View
                      style={[
                        styles.freshUnderline,
                        { transform: [{ scaleX: underlineAnim }] },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.exemplarMeta}>{attribution(e)}</Text>
              </View>
            ))}

            {heroOffering?.text ? (
              <View style={styles.offeringBox} testID="hero-offering">
                <Text style={styles.offeringText}>{heroOffering.text}</Text>
                <Text style={styles.offeringFrom}>FROM THE FIELD</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* B4 — gathering */}
        {gatheringRows.length > 0 && (
          <View testID="gathering-section">
            <Text style={styles.sectionHead}>gathering</Text>
            {gatheringRows.map((it) => {
              const exemplars = (patterns[it.type]?.exemplars?.[it.key] ?? []).slice(0, 2);
              // Rendered expanded, non-pressable — serif never sits inside
              // a pressable (T-c), and the prototype shows the open state.
              return (
                <View
                  key={`${it.type}:${it.key}`}
                  style={styles.gatherRow}
                  testID={`gathering-${it.key}`}
                >
                  <Text>
                    <Text style={styles.gatherItem}>
                      {it.phrase ? `“${displayItem(it.key)}”` : displayItem(it.key)}
                    </Text>
                    <Text style={styles.gatherTwice}> · twice</Text>
                  </Text>
                  <View style={styles.gatherPair}>
                    {exemplars.map((e, i) => (
                      <View key={`${e.fieldNoteId}-${i}`} style={styles.exemplarBlock}>
                        <HighlightedQuote
                          text={e.text}
                          itemKey={it.key}
                          style={styles.quote}
                        />
                        <Text style={styles.exemplarMeta}>{attribution(e)}</Text>
                      </View>
                    ))}
                    {it.phrase && (
                      <Text style={styles.gatherCaption}>
                        the same sentence, twice — shown side by side
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* B5 — today's arrivals */}
        {arrivals.length > 0 && (
          <View testID="todays-arrivals">
            <Text style={styles.sectionHead}>today's arrivals</Text>
            <View style={styles.chipRow}>
              {arrivals.map((w) => (
                <View key={w} style={styles.chip}>
                  <Text style={styles.chipText}>{w}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* B6 — the lenses: live rows + one collapsed listening line */}
        {hasField && (
          <View>
            <Text style={styles.sectionHead}>the lenses</Text>
            {liveRows.map(({ lens, status }) => (
              <Pressable
                key={lens.id}
                style={({ pressed }) => [styles.lensRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => {
                  if (lens.pattern !== null) router.push(`/lens/${lens.id}`);
                }}
                testID={`lens-${lens.id}`}
              >
                <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                <View style={styles.lensBody}>
                  <Text style={styles.lensName}>{lens.label}</Text>
                  {status.parts}
                </View>
                <Text style={styles.lensArrow}>→</Text>
              </Pressable>
            ))}
            {quietRows.length > 0 && (
              <Text style={styles.stillListening} testID="lenses-listening">
                {quietRows.map((r) => r.lens.label).join(" · ")} — listening.
              </Text>
            )}
          </View>
        )}

        {/* B8 — the field: the signature */}
        {hasField && (
          <View testID="field-signature">
            <Text style={styles.sectionHead}>the field</Text>
            <Text style={styles.signature}>{signature}</Text>
            <Text style={styles.signatureAge}>
              the field is {fieldAgeDays === 1 ? "one day" : `${spellNumber(fieldAgeDays)} days`} old.
            </Text>
          </View>
        )}

        {!hasField && (
          <Text style={styles.closingThought}>
            {"The Guide grows as you practice.\nReturn here as your field deepens."}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  scrollContent: {
    paddingHorizontal: 28,
  },

  // B1
  fieldLine: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: -14,
    marginBottom: 26,
  },

  // B2
  synthesisWrap: {
    marginBottom: 10,
  },
  eyebrow: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "#E08AAF",
    marginBottom: 10,
  },
  synthesis: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
  },
  synthesisItem: {
    ...TypeScale.serifBody,
    fontSize: 20,
    color: "#ffffff",
  },
  emptySynthesis: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(255,255,255,0.72)",
  },

  sectionHead: {
    ...TypeScale.sectionTitle,
    textTransform: "lowercase",
    color: colors.light.textSecondary,
    marginTop: 40,
    marginBottom: 14,
  },

  // B3 — hero
  heroWord: {
    ...TypeScale.serifDisplay,
    fontSize: 38,
    lineHeight: 44,
    color: "#ffffff",
  },
  heroCount: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  exemplarBlock: {
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.10)",
  },
  quoteWrap: {
    alignSelf: "flex-start",
  },
  quote: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.72)",
  },
  quoteHot: {
    color: "#ffffff",
  },
  freshUnderline: {
    height: 1,
    marginTop: 2,
    width: "56%",
    backgroundColor: "rgba(224,138,175,0.6)",
    alignSelf: "flex-start",
  },
  exemplarMeta: {
    ...TypeScale.metadata,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  offeringBox: {
    marginTop: 22,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  offeringText: {
    ...TypeScale.body,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.58)",
  },
  offeringFrom: {
    ...TypeScale.micro,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },

  // B4 — gathering
  gatherRow: {
    marginBottom: 14,
  },
  gatherItem: {
    ...TypeScale.serifBody,
    color: "#ffffff",
  },
  gatherTwice: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
  },
  gatherPair: {
    marginTop: 4,
  },
  gatherCaption: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 10,
  },

  // B5 — arrivals
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  chipText: {
    ...TypeScale.metadata,
    fontSize: 12,
    color: "rgba(255,255,255,0.58)",
    textTransform: "lowercase",
  },

  // B6 — lenses
  lensRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  lensDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 6,
  },
  lensBody: {
    flex: 1,
  },
  lensName: {
    ...TypeScale.bodyLarge,
    color: "#ffffff",
  },
  lensLive: {
    ...TypeScale.body,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.58)",
    marginTop: 5,
  },
  lensLiveItem: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
  },
  lensArrow: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  stillListening: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.4)",
    marginTop: 18,
  },

  // B8 — signature
  signature: {
    ...TypeScale.body,
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.55)",
  },
  signatureAge: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.4)",
    marginTop: 8,
  },

  closingThought: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
