import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { fetchFieldNotes, type FieldNoteWithId } from "@/lib/firestore";
import { openingLine, softTimeLabel, TYPE_LABEL } from "@/app/(tabs)/notes";

// Lens rows render but stay quiet until the pattern engine ships (Milestone D).
const LENSES = [
  { id: "resistance",    label: "recurring resistance", color: "#e08aaf" },
  { id: "threads",       label: "threads",              color: "#88dcba" },
  { id: "motifs",        label: "mythic motifs",        color: "#e9b76b" },
  { id: "conditions",    label: "conditions noted",     color: "#9bb6d6" },
  { id: "consciousness", label: "consciousness map",    color: "#c4baea" },
];

/**
 * A display title for an encounter, derived from its userEncounters doc id
 * (e.g. "the-threshold_t1" → "the threshold"). Offline-tolerant — no fetch.
 */
function encounterTitle(encounterRef: string | null): string {
  if (!encounterRef) return "spontaneous";
  const base = encounterRef.replace(/_t\d+$/, "");
  const words = base.replace(/-/g, " ").trim();
  return words.length > 0 ? words : "spontaneous";
}

/** "reflection · the threshold · 2 days ago" */
function sourceLabel(note: FieldNoteWithId, now: Date): string {
  const created = note.createdAt?.toDate?.() ?? null;
  const where =
    note.source === "encounter" ? encounterTitle(note.encounterRef) : "spontaneous";
  const when = created ? softTimeLabel(created, now) : "just now";
  return `${TYPE_LABEL[note.type]} · ${where} · ${when}`;
}

/** Distinct calendar days across all notes. */
function daysAcross(notes: FieldNoteWithId[]): number {
  const days = new Set<string>();
  for (const n of notes) {
    const d = n.createdAt?.toDate?.();
    if (d) days.add(d.toDateString());
  }
  return Math.max(days.size, notes.length > 0 ? 1 : 0);
}

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notes, setNotes] = useState<FieldNoteWithId[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());

  const refresh = useCallback(() => {
    const uid = user?.uid;
    if (!uid) {
      setNotes([]);
      return;
    }
    setNow(new Date());
    fetchFieldNotes(uid)
      .then(setNotes)
      .catch((err) => console.warn("guide feed unavailable", err));
  }, [user?.uid]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const hasField = notes.length > 0;
  const dayCount = daysAcross(notes);
  const mostRecent = notes[0] ?? null;

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

        {hasField ? (
          <>
            {/* Taking-root header — counts only, no interpretation */}
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldStateLabelFresh}>● TAKING ROOT</Text>
              <Text style={styles.fieldCount}>
                {`${notes.length} ${notes.length === 1 ? "note" : "notes"} across ${dayCount} ${dayCount === 1 ? "day" : "days"}.`}
              </Text>
            </View>

            {/* Your words, returning */}
            {mostRecent && (
              <View style={styles.returningWrap}>
                <Text style={styles.returningEyebrow}>YOUR WORDS, RETURNING</Text>
                <Text style={styles.returningLine}>“{openingLine(mostRecent)}”</Text>
                <Text style={styles.returningAttribution}>
                  {`— you, ${
                    mostRecent.createdAt?.toDate?.()
                      ? softTimeLabel(mostRecent.createdAt.toDate(), now)
                      : "just now"
                  }`}
                </Text>
              </View>
            )}

            {/* Lenses — listening until Milestone D */}
            <Text style={styles.lensesLabel}>EXPLORE</Text>
            {LENSES.map((lens) => (
              <View key={lens.id} style={styles.lensRow}>
                <View style={styles.lensLeft}>
                  <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                  <View style={styles.lensTextWrap}>
                    <Text style={styles.lensName}>{lens.label}</Text>
                    <Text style={styles.lensDesc}>listening.</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Chronological feed of all field notes */}
            <Text style={styles.feedLabel}>THE FIELD</Text>
            {notes.map((note) => (
              <View key={note.id} style={styles.feedItem}>
                <Text style={styles.feedLine} numberOfLines={2}>
                  {openingLine(note)}
                </Text>
                <Text style={styles.feedSource}>{sourceLabel(note, now)}</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Empty only when there are truly zero notes */}
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldStateLabelFresh}>● TAKING ROOT</Text>
            </View>

            <View style={styles.synthesisWrap}>
              <Text style={styles.synthesisText}>
                Your field begins with your first reflection. Patterns emerge with time
                and return.
              </Text>
            </View>

            <Text style={styles.lensesLabel}>EXPLORE</Text>
            {LENSES.map((lens) => (
              <View key={lens.id} style={styles.lensRow}>
                <View style={styles.lensLeft}>
                  <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
                  <View style={styles.lensTextWrap}>
                    <Text style={styles.lensName}>{lens.label}</Text>
                    <Text style={styles.lensDesc}>listening.</Text>
                  </View>
                </View>
              </View>
            ))}

            <Text style={styles.closingThought}>
              {"The Guide grows as you practice.\nReturn here as your field deepens."}
            </Text>
          </>
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
    marginBottom: 20,
  },
  fieldStateLabelFresh: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(196,74,138,0.85)",
    marginBottom: 6,
  },
  fieldCount: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },

  returningWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    marginBottom: 36,
  },
  returningEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 10,
  },
  returningLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 8,
  },
  returningAttribution: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },

  synthesisWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    marginBottom: 36,
  },
  synthesisText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.78)",
  },

  lensesLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  lensRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
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
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 3,
  },
  lensDesc: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 11,
    color: "rgba(255,255,255,0.42)",
  },

  feedLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginTop: 36,
    marginBottom: 16,
  },
  feedItem: {
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  feedLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 8,
  },
  feedSource: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.4)",
  },

  closingThought: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
