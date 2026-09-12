import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { doc as fsDoc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { FieldPassageSheet } from "@/components/FieldPassageSheet";
import { FieldLetterSheet } from "@/components/FieldLetterSheet";
import { FieldReadingSheet } from "@/components/FieldReadingSheet";
import { LinkWhisper } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import TabTopBar from "@/components/TabTopBar";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { db, functions } from "@/lib/firebase";
import { firstApprovedFieldPassage } from "@/lib/fieldPassages";
import { fieldNotesQuery, type FieldNoteWithId } from "@/lib/firestore";
import { subscribePatternDocuments } from "@/lib/patternEvidence";
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
  PractitionerContentDoc,
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
  { id: "conditions",    pattern: "conditions", label: "conditions",              color: "#9bb6d6" },
  { id: "consciousness", pattern: "consciousness", label: "consciousness",         color: "#c4baea" },
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

/** RETURNING hero only (Slice N): freshest contribution first. When two
 * returns are equally fresh, count wins, then phrase > lexicon > word. */
function heroFreshnessOrder(a: PoolItem, b: PoolItem): number {
  const rank = (i: PoolItem) => (i.phrase ? 2 : i.lexicon ? 1 : 0);
  return b.latestMs - a.latestMs || b.count - a.count || rank(b) - rank(a);
}

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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [fieldPassageOpen, setFieldPassageOpen] = useState(false);
  const [heroPassageContent, setHeroPassageContent] =
    useState<PractitionerContentDoc | null>(null);
  // Empty state only — each lens row carries its held line, verbatim
  // from the seeded teaching docs.
  const [heldLines, setHeldLines] = useState<Record<string, string>>({});

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
    const unsubPatterns = subscribePatternDocuments(
      user.uid,
      (next) => {
        setPatterns(next);
        setPatternsLoaded(true);
      },
      (err) => {
        setPatterns({});
        setPatternsLoaded(false);
        console.warn("guide patterns", err);
      }
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
      (n) => !!n.content && n.transcriptStatus !== "pending" && !ledgered.has(n.id)
    );
    if (!missing) return;
    selfHealAttempted = true;
    httpsCallable(functions, "backfillPatterns")({}).catch((err) =>
      console.warn("backfillPatterns", err)
    );
  }, [user, notes, patterns, patternsLoaded]);

  // ── Field arithmetic ─────────────────────────────────────────────
  const hasField = notes.length > 0;

  // ── Held lines (fetched once, every field state — quiet rows carry
  // their held line as subtitle; single source: the seeded teaching docs) ──
  const heldLinesFetched = useRef(false);
  useEffect(() => {
    if (!user || heldLinesFetched.current) return;
    heldLinesFetched.current = true; // one attempt per mount — empty or
    // failed reads render name-only rows rather than refetching forever.
    let cancelled = false;
    Promise.all(
      LENSES.map((l) =>
        getDoc(fsDoc(db, "practitionerContent", `teaching_${l.id}`))
          .then((snap) => {
            const data = snap.exists()
              ? (snap.data() as { kind?: string; heldLine?: string })
              : null;
            return [l.id, data?.kind === "teaching" ? data.heldLine ?? "" : ""] as const;
          })
          .catch(() => [l.id, ""] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, line] of pairs) if (line) next[id] = line;
      setHeldLines(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const noteDates = notes
    .map((n) => n.createdAt?.toDate?.())
    .filter(Boolean) as Date[];
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

  // ── The hero: freshest return within the current threshold tier ──
  const hero: PoolItem | null = useMemo(() => {
    if (established.length > 0) return [...established].sort(heroFreshnessOrder)[0];
    if (gathering.length > 0) return [...gathering].sort(heroFreshnessOrder)[0];
    if (arrivals.length > 0) {
      const stemKey = contentWords(arrivals[0].word)[0]?.stem ?? arrivals[0].word;
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

  // G2 — passage availability is live, so a founder approval can open this
  // door without a client deploy. Only motif content has a field passage sheet.
  useEffect(() => {
    if (!hero || hero.type !== "motif") {
      setHeroPassageContent(null);
      setFieldPassageOpen(false);
      return;
    }
    return onSnapshot(
      fsDoc(db, "practitionerContent", `motif_${hero.key}`),
      (snap) =>
        setHeroPassageContent(
          snap.exists() ? (snap.data() as PractitionerContentDoc) : null
        ),
      () => setHeroPassageContent(null)
    );
  }, [hero?.key, hero?.type]);
  const heroApprovedPassage = firstApprovedFieldPassage(heroPassageContent);

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

  // ── GATHERING rows (D.3d §1d): hero excluded, phrases first, max 3;
  //    a single WORD must be ≥4 characters to display here (§3.2) ──
  const gatheringRows = useMemo(
    () =>
      gathering
        .filter((i) => i.key !== hero?.key)
        .filter((i) => i.phrase || i.key.length >= 4)
        .sort((a, b) => Number(b.phrase) - Number(a.phrase) || heroOrder(a, b))
        .slice(0, 3),
    [gathering, hero]
  );
  const [openGatherKey, setOpenGatherKey] = useState<string | null>(null);
  // A live snapshot can remove the open row (item became the hero, count
  // moved past two) — never let stale state reopen it on re-entry.
  useEffect(() => {
    if (openGatherKey && !gatheringRows.some((i) => i.key === openGatherKey)) {
      setOpenGatherKey(null);
    }
  }, [gatheringRows, openGatherKey]);

  // ── Taking-root moment, retargeted (D.3d §0.1): hero word bloom +
  //    root-line underline, once per completion, never on ordinary opens ──
  const bloomAnim = useRef(new Animated.Value(1)).current;
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
        bloomAnim.setValue(0);
        underlineAnim.setValue(0);
        Animated.timing(bloomAnim, {
          toValue: 1,
          duration: 1100,
          delay: 200,
          useNativeDriver: false,
        }).start();
        Animated.timing(underlineAnim, {
          toValue: 1,
          duration: 1400,
          delay: 1000,
          useNativeDriver: false,
        }).start();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completions, bloomAnim, underlineAnim]);

  // ── Lens rows — live only; COUNT PHRASE only, no prose (D.3d §1g) ──
  const resistanceNotes = notes.filter((n) => n.type === "resistance");

  function lensStatus(lensId: string): {
    phrase: string | null;
    live: boolean;
    weight: number;
  } {
    if (lensId === "threads") {
      const threadItems = visibleItems.filter(
        (i) => i.type === "thread" && i.count >= 2
      );
      const words = threadItems.filter((i) => !i.phrase).length;
      const phrases = threadItems.filter((i) => i.phrase).length;
      const pieces: string[] = [];
      if (words) pieces.push(`${spellNumber(words)} ${words === 1 ? "word" : "words"}`);
      if (phrases) pieces.push(`${spellNumber(phrases)} ${phrases === 1 ? "phrase" : "phrases"}`);
      if (pieces.length === 0) return { phrase: null, live: false, weight: 0 };
      return { phrase: pieces.join(" · "), live: true, weight: threadItems.length };
    }
    if (lensId === "motifs") {
      const n = visibleItems.filter((i) => i.type === "motif" && i.count >= 2).length;
      if (n === 0) return { phrase: null, live: false, weight: 0 };
      return { phrase: `${spellNumber(n)} returning`, live: true, weight: n };
    }
    if (lensId === "resistance") {
      const items = visibleItems
        .filter((i) => i.type === "resistance")
        .sort((a, b) => b.count - a.count);
      if (items.length > 0 && items[0].count >= 2) {
        return {
          phrase: `the same wall, ${spellNumber(items[0].count)} times`,
          live: true,
          weight: items[0].count,
        };
      }
      const n = Math.max(items.length, resistanceNotes.length);
      if (n > 0) {
        return {
          phrase: n === 1 ? "one wall named" : `${spellNumber(n)} walls named`,
          live: true,
          weight: n,
        };
      }
      return { phrase: null, live: false, weight: 0 };
    }
    if (lensId === "consciousness") {
      const leading = patterns.consciousness?.leading;
      if (!leading) return { phrase: null, live: false, weight: 0 };
      const weight = patterns.consciousness?.structureCounts?.[leading] ?? 0;
      if (weight < 1) return { phrase: null, live: false, weight: 0 };
      return {
        phrase: `your words stand in the ${leading}`,
        live: true,
        weight,
      };
    }
    if (lensId === "conditions") {
      const n = patterns.conditions?.findings?.length ?? 0;
      if (n === 0) return { phrase: null, live: false, weight: 0 };
      return {
        phrase: `${spellNumber(n)} ${n === 1 ? "weather" : "weathers"} noted`,
        live: true,
        weight: n,
      };
    }
    return { phrase: null, live: false, weight: 0 };
  }

  // Final ruling — all five rows, always: live first (by activity),
  // then quiet in canonical order. Array#sort is stable, so equal
  // weights keep canonical order among themselves.
  const lensRows = LENSES.map((l) => ({ lens: l, status: lensStatus(l.id) }));
  const liveRows = lensRows
    .filter((r) => r.status.live)
    .sort((a, b) => b.status.weight - a.status.weight);
  const quietRows = lensRows.filter((r) => !r.status.live);

  // ── Footer signature, one line (D.3d §1h) ────────────────────────
  const signature = useMemo(() => {
    const byType = new Map<string, number>();
    for (const n of notes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    return [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, c]) => `${spellNumber(c)} ${type}${c === 1 ? "" : "s"}`)
      .join(" · ");
  }, [notes]);

  // Hero whisper destination — the lens that owns the item.
  const heroLensId =
    hero?.type === "motif" ? "motifs" : hero?.type === "resistance" ? "resistance" : "threads";

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
        {/* §1a — header, centered, field line centered beneath */}
        <TabTopBar title="FIELD GUIDE" rightIcon="⌕" />
        {hasField && (
          <Text style={styles.fieldLine} testID="guide-field-line">
            {spellNumber(notes.length)} {notes.length === 1 ? "note" : "notes"} ·{" "}
            {fieldAgeDays <= 7 ? "the first week" : `${spellNumber(fieldAgeDays)} days`}
          </Text>
        )}

        {/* Empty state — the opening description (retires once the field lives) */}
        {!hasField && (
          <View style={styles.openingWrap} testID="guide-opening">
            <Text style={styles.openingBody}>{OPENING_PARAGRAPHS[0]}</Text>
            <Text style={[styles.openingBody, styles.openingSecond]}>
              {OPENING_PARAGRAPHS[1]}
            </Text>
          </View>
        )}

        {/* Empty state — the lenses, all five, each already a door.
            The description joins the Guide; it does not replace it.
            Held line renders outside the Pressable (serif never sits
            inside a pressable — T-c), beneath the tappable name row. */}
        {!hasField && (
          <View testID="empty-lenses-section">
            <Text style={styles.sectionHead}>the lenses</Text>
            {LENSES.map((lens) => (
              <View key={lens.id} style={styles.lensRow} testID={`empty-lens-${lens.id}`}>
                <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                <View style={styles.lensBody}>
                  <Pressable
                    style={({ pressed }) => [styles.emptyLensPress, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => router.push(`/lens/${lens.id}`)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    testID={`empty-lens-press-${lens.id}`}
                  >
                    <Text style={styles.lensName}>{lens.label}</Text>
                    <Text style={styles.lensArrow}>→</Text>
                  </Pressable>
                  {heldLines[lens.id] ? (
                    <Text style={styles.lensHeld}>{heldLines[lens.id]}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* §1b — RETURNING: the hero */}
        {hero && (
          <View style={styles.heroSection} testID="returning-hero">
            <Text style={styles.eyebrow}>returning</Text>
            <View style={styles.heroRow}>
              <Animated.Text
                style={[
                  styles.heroWord,
                  freshMoment && {
                    opacity: bloomAnim,
                    letterSpacing: bloomAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [3, 0.6],
                    }),
                  },
                ]}
                testID="hero-item"
              >
                {displayItem(hero.key)}
              </Animated.Text>
              <Text style={styles.heroCount}>
                {hero.count} {hero.count === 1 ? "note" : "notes"} · {heroSpan}
              </Text>
            </View>

            {heroExemplars.length > 0 && (() => {
              const e = heroExemplars[heroExemplars.length - 1]; // the freshest
              return (
                <View style={styles.exemplarBlock}>
                  <View style={styles.quoteWrap}>
                    <HighlightedQuote text={e.text} itemKey={hero.key} style={styles.quote} />
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
              );
            })()}

            {hero.count > 1 && (
              <LinkWhisper
                label={
                  hero.count === 2 ? "both notes" : `all ${spellNumber(hero.count)} notes`
                }
                onPress={() => router.push(`/lens/${heroLensId}`)}
                style={styles.heroWhisper}
                testID="hero-all-notes"
              />
            )}

            {heroApprovedPassage ? (
              <Pressable
                style={({ pressed }) => [styles.offeringBox, pressed && styles.offeringPressDim]}
                onPress={() => setFieldPassageOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`More from the field: ${displayItem(hero.key)}`}
                testID="hero-field-passage-card"
              >
                <Text style={styles.offeringText}>{heroApprovedPassage.text}</Text>
                <Text style={styles.offeringFrom}>FROM THE FIELD</Text>
                <Text style={styles.offeringMore}>more from the field →</Text>
              </Pressable>
            ) : heroOffering?.text ? (
              <View style={styles.offeringBox} testID="hero-offering">
                <Text style={styles.offeringText}>{heroOffering.text}</Text>
                <Text style={styles.offeringFrom}>FROM THE FIELD</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* §1d — GATHERING: collapsed rows; tap expands in place, accordion */}
        {gatheringRows.length > 0 && (
          <View style={styles.section} testID="gathering-section">
            <Text style={styles.eyebrow}>gathering</Text>
            {gatheringRows.map((it) => {
              const open = openGatherKey === it.key;
              const exemplars = (patterns[it.type]?.exemplars?.[it.key] ?? []).slice(0, 2);
              return (
                <View key={`${it.type}:${it.key}`}>
                  {/* Serif never sits inside a pressable (T-c): the row is
                      plain Views; a sibling press target overlays it. */}
                  <View style={styles.gatherRow}>
                    <Text style={styles.gatherItem}>
                      {it.phrase ? `“${displayItem(it.key)}”` : displayItem(it.key)}
                    </Text>
                    <Text style={styles.gatherTwice}>
                      {it.count === 2 ? "twice" : `${spellNumber(it.count)} times`}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        StyleSheet.absoluteFillObject,
                        pressed && styles.gatherPressDim,
                      ]}
                      onPress={() => setOpenGatherKey(open ? null : it.key)}
                      accessibilityRole="button"
                      accessibilityLabel={displayItem(it.key)}
                      accessibilityState={{ expanded: open }}
                      testID={`gathering-${it.key}`}
                    />
                  </View>
                  {open && (
                    <View style={styles.gatherPair} testID={`gathering-open-${it.key}`}>
                      {exemplars.map((e, i) => (
                        <View key={`${e.fieldNoteId}-${i}`} style={styles.exemplarBlock}>
                          <HighlightedQuote text={e.text} itemKey={it.key} style={styles.quote} />
                          <Text style={styles.exemplarMeta}>{attribution(e)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* §1f — ARRIVING TODAY: chips with in-day counts */}
        {arrivals.length > 0 && (
          <View style={styles.section} testID="todays-arrivals">
            <Text style={styles.eyebrow}>arriving today</Text>
            <View style={styles.chipRow}>
              {arrivals.map((a) => (
                <View key={a.word} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {a.word}
                    <Text style={styles.chipCount}>  {a.count}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* §1g — THE LENSES (final ruling): all five rows, always.
            Live first (by activity), then quiet in canonical order.
            Every row is a door to its detail view. */}
        {hasField && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>the lenses</Text>
            {liveRows.map(({ lens, status }) => (
              <Pressable
                key={lens.id}
                style={({ pressed }) => [styles.lensRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(`/lens/${lens.id}`)}
                testID={`lens-${lens.id}`}
              >
                <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                <Text style={styles.lensName}>{lens.label}</Text>
                {status.phrase ? <Text style={styles.lensCount}>{status.phrase}</Text> : null}
                <Text style={styles.lensArrow}>→</Text>
              </Pressable>
            ))}
            {/* Quiet rows — held line as subtitle, from the seeded teaching
                docs (never hardcoded). Serif never sits inside a pressable
                (T-c): the held line renders beneath, outside the press row. */}
            {quietRows.map(({ lens }) => (
              <View key={lens.id} style={styles.lensRow} testID={`quiet-lens-${lens.id}`}>
                <View
                  style={[styles.lensDot, { backgroundColor: lens.color, opacity: 0.5 }]}
                />
                <View style={styles.lensBody}>
                  <Pressable
                    style={({ pressed }) => [styles.emptyLensPress, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => router.push(`/lens/${lens.id}`)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    testID={`quiet-lens-press-${lens.id}`}
                  >
                    <Text style={styles.quietLensName}>{lens.label}</Text>
                    <Text style={styles.lensArrow}>→</Text>
                  </Pressable>
                  {heldLines[lens.id] ? (
                    <Text style={styles.lensHeld}>{heldLines[lens.id]}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* §1h — footer signature, one line, hairline above */}
        {hasField && (
          <Text style={styles.footerSig} testID="field-signature">
            {signature} · the field is{" "}
            {fieldAgeDays === 1 ? "one day" : `${spellNumber(fieldAgeDays)} days`} old
          </Text>
        )}

        {/* Footer doors retain the canonical order: reflection, letter, guide. */}
        {profile?.readingsEnabled === true && notes.length >= 7 ? (
          <LinkWhisper
            label="a reflection →"
            onPress={() => setReadingOpen(true)}
            style={styles.readingLink}
            testID="guide-reading-link"
          />
        ) : null}
        {!user?.isAnonymous && !!user?.email && notes.length >= 15 ? (
          <LinkWhisper
            label="request a letter →"
            onPress={() => setLetterOpen(true)}
            style={styles.letterLink}
            testID="guide-letter-link"
          />
        ) : null}
        {/* Permanent footer whisper — the opening text, summoned as a sheet */}
        <LinkWhisper
          label="about the guide"
          onPress={() => setAboutOpen(true)}
          style={styles.aboutLink}
          testID="guide-about-link"
        />
      </ScrollView>

      <SheetShell
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        bottomPad={insets.bottom}
        swipeToDismiss
        modal
        testID="about-guide-sheet"
      >
        <ScrollView
          style={{ maxHeight: Dimensions.get("window").height * 0.62 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.openingBody}>{OPENING_PARAGRAPHS[0]}</Text>
          <Text style={[styles.openingBody, styles.openingSecond]}>
            {OPENING_PARAGRAPHS[1]}
          </Text>
        </ScrollView>
      </SheetShell>

      <FieldReadingSheet
        open={readingOpen}
        uid={user?.uid ?? null}
        onClose={() => setReadingOpen(false)}
        bottomPad={insets.bottom}
      />
      <FieldLetterSheet
        open={letterOpen}
        onClose={() => setLetterOpen(false)}
        bottomPad={insets.bottom}
      />
      <FieldPassageSheet
        open={fieldPassageOpen}
        onClose={() => setFieldPassageOpen(false)}
        bottomPad={insets.bottom}
        motifName={hero ? displayItem(hero.key) : ""}
        content={heroPassageContent}
        exemplars={heroExemplars}
        attribution={attribution}
        testID="guide-field-passage-sheet"
      />
    </View>
  );
}

// FINAL canon, verbatim — the Guide's opening description.
const OPENING_PARAGRAPHS = [
  "The Field Guide doesn't explain your life. It helps you notice the patterns your life has already been repeating: A phrase you keep using, resistance that won't loosen, an image that follows you from dream to conversation to notebook.",
  "Across traditions, these repetitions were never treated as accidents. They were treated as instruction.",
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  scrollContent: {
    paddingHorizontal: 28,
  },

  // §1a — centered field line
  fieldLine: {
    ...TypeScale.metadata,
    textAlign: "center",
    color: colors.light.textMuted,
    marginTop: -14,
    marginBottom: 26,
  },

  // §0.2 — Guide-scoped section marker: the eyebrow register, textMuted
  eyebrow: {
    ...TypeScale.eyebrow,
    color: colors.light.textMuted,
  },

  // §2 — vertical rhythm: 34pt title block → hero, 26pt between sections
  heroSection: {
    marginTop: 34,
  },
  section: {
    marginTop: 26,
  },

  openingWrap: {
    marginBottom: 10,
  },
  openingBody: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
  },
  openingSecond: {
    marginTop: 16,
  },

  sectionHead: {
    ...TypeScale.sectionTitle,
    textTransform: "lowercase",
    color: colors.light.textSecondary,
    marginTop: 40,
    marginBottom: 14,
  },

  // §1b — hero: serifDisplay (30) with the count on the same baseline
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 12,
  },
  heroWord: {
    ...TypeScale.serifDisplay,
    color: "#ffffff",
  },
  heroCount: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
  },
  heroWhisper: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  exemplarBlock: {
    marginTop: 16,
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
    marginTop: 18,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  offeringText: {
    ...TypeScale.body,
    color: colors.light.textTertiary,
  },
  offeringFrom: {
    ...TypeScale.micro,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  offeringMore: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
  },
  offeringPressDim: {
    opacity: 0.72,
  },

  // §1d — gathering: collapsed rows, item left, count word right, hairline
  gatherRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  gatherItem: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
    flex: 1,
  },
  gatherTwice: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
  },
  gatherPressDim: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gatherPair: {
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },

  // §1f — arriving today
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  chipText: {
    ...TypeScale.label,
    color: colors.light.textTertiary,
    textTransform: "lowercase",
  },
  chipCount: {
    ...TypeScale.label,
    color: colors.light.textMuted,
  },

  // §1g — lenses: dot · name · count phrase · →, 11pt row padding
  lensRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  lensDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  lensBody: {
    flex: 1,
  },
  lensName: {
    ...TypeScale.body,
    color: "#ffffff",
    flex: 1,
  },
  lensCount: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
  },
  lensArrow: {
    ...TypeScale.body,
    color: colors.light.textMuted,
  },
  emptyLensPress: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  lensHeld: {
    ...TypeScale.serifSmall,
    color: colors.light.textSecondary,
    marginTop: 5,
  },
  quietLensName: {
    ...TypeScale.body,
    color: colors.light.textSecondary,
    flex: 1,
  },

  // §1h — footer signature, one line, hairline above
  footerSig: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
    marginTop: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },

  aboutLink: {
    alignSelf: "flex-start",
    marginTop: 16,
  },
  readingLink: {
    alignSelf: "flex-start",
    marginTop: 44,
  },
  letterLink: {
    alignSelf: "flex-start",
    marginTop: 16,
  },
});
