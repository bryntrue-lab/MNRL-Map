import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
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
import { LinkWhisper } from "@/components/Links";
import TabTopBar from "@/components/TabTopBar";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { fieldNotesQuery, type FieldNoteWithId } from "@/lib/firestore";
import { spellOut, todaysArrivals } from "@/lib/patternText";
import type {
  ExemplarEntry,
  FieldNoteDoc,
  PatternDoc,
  PatternType,
} from "@/types/firestore";

// Task D §2 — the Field Guide. The engine counts; the Guide echoes the
// counts and quotes verbatim. No sentence has the user as subject of an
// interpretive verb. Tier language is fixed: entered your field · has
// appeared twice · appears in N of your notes.

const LENSES: {
  id: string;
  pattern: PatternType | null;
  label: string;
  color: string;
  promise: string;
}[] = [
  { id: "resistance",    pattern: "resistance", label: "recurring resistance",   color: "#e08aaf", promise: "when the same wall is named three times, it appears here." },
  { id: "threads",       pattern: "thread",     label: "your recurring language", color: "#88dcba", promise: "phrases you repeat without noticing, heard at three notes." },
  { id: "motifs",        pattern: "motif",      label: "mythic motifs",           color: "#e9b76b", promise: "images that return across your field, counted." },
  { id: "conditions",    pattern: null,         label: "conditions noted",        color: "#9bb6d6", promise: "what you name alongside the charged days." },
  { id: "consciousness", pattern: null,         label: "consciousness map",       color: "#c4baea", promise: "the structures moving through your words." },
];

const SOURCE_LABEL: Record<string, string> = {
  encounter: "the threshold",
  spontaneous: "the field",
};

const SEEN_COMPLETIONS_KEY = "mineral_guide_seen_completions";

function openingLine(n: FieldNoteDoc): string {
  if (n.content) {
    const line = n.content.split("\n").find((l) => l.trim().length > 0);
    if (line) return line.trim();
  }
  if (n.captureMode === "audio") {
    return n.transcriptStatus === "pending" ? "spoken — words arriving…" : "spoken.";
  }
  return "kept.";
}

function whenLabel(n: FieldNoteDoc): string {
  const created = n.createdAt?.toDate?.();
  if (!created) return "";
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

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

/** All counted items across the live docs: [item, count, patternType]. */
function allItems(patterns: Patterns): [string, number, PatternType][] {
  const out: [string, number, PatternType][] = [];
  for (const type of ["thread", "motif", "resistance"] as PatternType[]) {
    const counts = patterns[type]?.itemCounts ?? {};
    for (const [item, count] of Object.entries(counts)) out.push([item, count, type]);
  }
  return out;
}

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [notes, setNotes] = useState<FieldNoteWithId[]>([]);
  const [patterns, setPatterns] = useState<Patterns>({});
  const [expandedGathering, setExpandedGathering] = useState<string | null>(null);

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
      },
      (err) => console.warn("guide patterns", err)
    );
    return () => {
      unsubNotes();
      unsubPatterns();
    };
  }, [user]);

  const hasField = notes.length > 0;
  const dayCount = new Set(
    notes
      .map((n) => n.createdAt?.toDate?.())
      .filter(Boolean)
      .map((d) => (d as Date).toDateString())
  ).size;
  const mostRecent = notes[0] ?? null;

  const arrivals = useMemo(() => todaysArrivals(notes), [notes]);

  // ── The synthesis sentence — always present, chosen by precedence,
  //    engine voice (counts only). ──────────────────────────────────
  const items = useMemo(() => allItems(patterns), [patterns]);
  const synthesis = useMemo(() => {
    const established = items.filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
    if (established.length > 0 && notes.length > 0) {
      const [item, count] = established[0];
      return `The ${item} appears in ${spellOut(count)} of your ${spellOut(
        notes.length
      )} notes.`;
    }
    const gathering = items.filter(([, c]) => c === 2);
    if (gathering.length > 0) {
      const [item] = gathering.sort((a, b) => a[0].localeCompare(b[0]))[0];
      return `${item.charAt(0).toUpperCase()}${item.slice(1)} has appeared twice.`;
    }
    if (arrivals.length > 0) {
      const n = arrivals.length;
      const word = spellOut(n);
      return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${
        n === 1 ? "word" : "words"
      } entered your field today.`;
    }
    return `${spellOut(notes.length).charAt(0).toUpperCase()}${spellOut(
      notes.length
    ).slice(1)} ${notes.length === 1 ? "note" : "notes"} across ${spellOut(
      dayCount
    )} ${dayCount === 1 ? "day" : "days"}.`;
  }, [items, arrivals, notes.length, dayCount]);

  // ── GATHERING — items at count 2 ─────────────────────────────────
  const gatheringItems = useMemo(
    () =>
      items
        .filter(([, c]) => c === 2)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [items]
  );

  // ── Post-encounter freshness moment (taking root) — once per
  //    completion, never on ordinary opens. ─────────────────────────
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
        // first ever visit: record, no ceremony for the past
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
          // the eyebrow pulses in
          Animated.timing(eyebrowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(eyebrowAnim, { toValue: 0.55, duration: 220, useNativeDriver: false }),
          Animated.timing(eyebrowAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
        ]).start();
        // the synthesis sentence lands at 600ms
        Animated.timing(synthesisAnim, {
          toValue: 1,
          duration: 500,
          delay: 600,
          useNativeDriver: false,
        }).start();
        // the freshest fragment underlines left-to-right
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

  // Lens row subtitle: top item as a count (`door · 4 notes`) once live.
  function lensSubtitle(lens: (typeof LENSES)[number]): string {
    if (lens.id === "threads") {
      const est = Object.entries(patterns.thread?.itemCounts ?? {})
        .filter(([, c]) => c >= 3)
        .sort((a, b) => b[1] - a[1]);
      if (est.length > 0) return `${est[0][0]} · ${est[0][1]} notes`;
    }
    if (lens.id === "motifs") {
      const top = Object.entries(patterns.motif?.itemCounts ?? {}).sort(
        (a, b) => b[1] - a[1]
      );
      if (top.length > 0)
        return `${top[0][0]} · ${top[0][1]} ${top[0][1] === 1 ? "note" : "notes"}`;
    }
    if (lens.id === "resistance") {
      const resistanceNotes = notes.filter((n) => n.type === "resistance").length;
      const top = Object.entries(patterns.resistance?.itemCounts ?? {}).sort(
        (a, b) => b[1] - a[1]
      );
      if (top.length > 0)
        return `${top[0][0]} · ${top[0][1]} ${top[0][1] === 1 ? "note" : "notes"}`;
      if (resistanceNotes > 0)
        return `resistance · ${resistanceNotes} ${resistanceNotes === 1 ? "note" : "notes"}`;
    }
    return "listening.";
  }

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
        <TabTopBar title="FIELD GUIDE" rightIcon="⌕" />

        {/* Taking-root header — counts only, no interpretation (§7) */}
        {hasField ? (
          <View style={styles.fieldHeader} testID="taking-root-header">
            <Animated.Text
              style={[styles.fieldStateLabelFresh, freshMoment && { opacity: eyebrowAnim }]}
            >
              ● TAKING ROOT
            </Animated.Text>
            <Animated.Text
              style={[styles.synthesisSentence, freshMoment && { opacity: synthesisAnim }]}
              testID="guide-synthesis"
            >
              {synthesis}
            </Animated.Text>
          </View>
        ) : (
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldStateLabelFresh}>● TAKING ROOT</Text>
            <Text style={styles.synthesisText}>
              Your field begins with your first reflection. Patterns emerge with time
              and return.
            </Text>
          </View>
        )}

        {/* TODAY'S ARRIVALS — first occurrences, verbatim, lowercase,
            max 7. Present every day the user captures. */}
        {arrivals.length > 0 && (
          <View style={styles.arrivalsWrap} testID="todays-arrivals">
            <Text style={styles.quietLabel}>TODAY'S ARRIVALS</Text>
            <View style={styles.chipRow}>
              {arrivals.map((w) => (
                <View key={w} style={styles.chip}>
                  <Text style={styles.chipText}>{w}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* GATHERING — items at two; the anticipation engine */}
        {gatheringItems.length > 0 && (
          <View testID="gathering-section">
            <Text style={styles.quietLabel}>GATHERING</Text>
            {gatheringItems.map(([item, , type]) => {
              const exemplars = patterns[type]?.exemplars?.[item] ?? [];
              const open = expandedGathering === `${type}:${item}`;
              return (
                <View key={`${type}:${item}`}>
                  <Pressable
                    style={styles.gatheringRow}
                    onPress={() =>
                      setExpandedGathering(open ? null : `${type}:${item}`)
                    }
                    testID={`gathering-${item}`}
                  >
                    <Text style={styles.gatheringItem}>
                      {item} · <Text style={styles.gatheringTwice}>twice</Text>
                    </Text>
                    <Text style={styles.lensArrow}>{open ? "↑" : "↓"}</Text>
                  </Pressable>
                  {open &&
                    exemplars.map((e, i) => (
                      <View key={`${e.fieldNoteId}-${i}`} style={styles.exemplarWrap}>
                        <Text style={styles.exemplarText}>“{e.text}”</Text>
                        <Text style={styles.exemplarMeta}>{attribution(e)}</Text>
                      </View>
                    ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Your words, returning — the most recent capture, verbatim (§7) */}
        {mostRecent && (
          <View style={styles.returningWrap} testID="words-returning">
            <Text style={styles.returningLabel}>YOUR WORDS, RETURNING</Text>
            <View style={styles.returningLineWrap}>
              <Text style={styles.returningLine}>“{openingLine(mostRecent)}”</Text>
              {freshMoment && (
                <Animated.View
                  style={[
                    styles.freshUnderline,
                    {
                      transform: [{ scaleX: underlineAnim }],
                    },
                  ]}
                />
              )}
            </View>
            <Text style={styles.returningMeta}>
              {mostRecent.type} · {SOURCE_LABEL[mostRecent.source] ?? mostRecent.source}
              {whenLabel(mostRecent) ? ` · ${whenLabel(mostRecent)}` : ""}
            </Text>
          </View>
        )}

        {/* Lenses — three live, two listening (Milestone D) */}
        <Text style={styles.sectionHead}>EXPLORE</Text>
        {LENSES.map((lens) => {
          const subtitle = lensSubtitle(lens);
          const live = lens.pattern !== null && subtitle !== "listening.";
          return (
            <Pressable
              key={lens.id}
              style={({ pressed }) => [styles.lensRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                if (lens.pattern !== null) router.push(`/lens/${lens.id}`);
              }}
              testID={`lens-${lens.id}`}
            >
              <View style={styles.lensLeft}>
                <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                <View style={styles.lensTextWrap}>
                  <Text style={styles.lensName}>{lens.label}</Text>
                  <Text style={styles.lensDesc}>{subtitle}</Text>
                  {!live && <Text style={styles.lensPromise}>{lens.promise}</Text>}
                </View>
              </View>
              <Text style={styles.lensArrow}>→</Text>
            </Pressable>
          );
        })}

        {/* 2.1.4c — the Notes tab owns the archive; the Guide owns the
            mirror. Three freshest notes only, then a quiet link out. */}
        {hasField && (
          <View>
            <Text style={styles.sectionHead}>FRESH</Text>
            {notes.slice(0, 3).map((n) => (
              <View key={n.id} style={styles.noteItem} testID={`guide-note-${n.id}`}>
                <Text style={styles.noteLine} numberOfLines={2}>
                  {openingLine(n)}
                </Text>
                <Text style={styles.noteMeta}>
                  {n.type} · {SOURCE_LABEL[n.source] ?? n.source}
                  {whenLabel(n) ? ` · ${whenLabel(n)}` : ""}
                </Text>
              </View>
            ))}
            <LinkWhisper
              label="the whole field lives in notes →"
              onPress={() => router.push("/notes")}
              testID="guide-whole-field-link"
            />
          </View>
        )}

        {/* Closing thought — only when the field is empty */}
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

  fieldHeader: {
    marginBottom: 24,
  },
  fieldStateLabelFresh: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "#E08AAF",
    marginBottom: 8,
  },
  synthesisSentence: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.85)",
  },
  synthesisText: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(255,255,255,0.72)",
  },

  quietLabel: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  arrivalsWrap: {
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipText: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.72)",
    textTransform: "lowercase",
  },

  gatheringRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  gatheringItem: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.85)",
  },
  gatheringTwice: {
    color: "rgba(255,255,255,0.5)",
  },
  exemplarWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  exemplarText: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 3,
  },
  exemplarMeta: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },

  returningWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 36,
  },
  returningLabel: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  returningLineWrap: {
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  returningLine: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.85)",
  },
  freshUnderline: {
    height: 1,
    marginTop: 2,
    backgroundColor: "rgba(224,138,175,0.6)",
    transformOrigin: "left",
  },
  returningMeta: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },

  sectionHead: {
    ...TypeScale.sectionTitle,
    textTransform: "lowercase",
    color: colors.light.textSecondary,
    marginTop: 32,
    marginBottom: 13,
  },
  lensRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  lensLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  lensDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  lensTextWrap: {
    flex: 1,
  },
  lensName: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 3,
  },
  lensDesc: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
  },
  lensPromise: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 3,
  },
  lensArrow: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
    marginLeft: 8,
  },

  noteItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  noteLine: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  noteMeta: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
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
