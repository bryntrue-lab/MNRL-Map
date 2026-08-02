import { router } from "expo-router";
import { onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
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
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { fieldNotesQuery, type FieldNoteWithId } from "@/lib/firestore";
import type { FieldNoteDoc } from "@/types/firestore";

// §C.1 7 — interim Guide: chronological feed + taking-root header from the
// FIRST capture. Lens rows render but read "listening." until Milestone D.

// 2.1.4b — each lens declares its promise beneath "listening." (verbatim).
const LENSES = [
  { id: "resistance",    label: "recurring resistance", color: "#e08aaf", promise: "when the same wall is named three times, it appears here." },
  { id: "threads",       label: "threads",              color: "#88dcba", promise: "phrases you repeat without noticing, heard at three notes." },
  { id: "motifs",        label: "mythic motifs",        color: "#e9b76b", promise: "images that return across your field, counted." },
  { id: "conditions",    label: "conditions noted",     color: "#9bb6d6", promise: "what you name alongside the charged days." },
  { id: "consciousness", label: "consciousness map",    color: "#c4baea", promise: "the structures moving through your words." },
];

const SOURCE_LABEL: Record<string, string> = {
  encounter: "the threshold",
  spontaneous: "the field",
};

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

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notes, setNotes] = useState<FieldNoteWithId[]>([]);
  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }
    const unsub = onSnapshot(
      fieldNotesQuery(user.uid),
      (snap) =>
        setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as FieldNoteDoc) }))),
      (err) => console.warn("guide notes", err)
    );
    return unsub;
  }, [user]);

  const hasField = notes.length > 0;
  const dayCount = new Set(
    notes
      .map((n) => n.createdAt?.toDate?.())
      .filter(Boolean)
      .map((d) => (d as Date).toDateString())
  ).size;
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

        {/* Taking-root header — counts only, no interpretation (§7) */}
        {hasField ? (
          <View style={styles.fieldHeader} testID="taking-root-header">
            <Text style={styles.fieldStateLabelFresh}>● TAKING ROOT</Text>
            <Text style={styles.fieldCount}>
              {notes.length} {notes.length === 1 ? "note" : "notes"} across {dayCount}{" "}
              {dayCount === 1 ? "day" : "days"}.
            </Text>
            {/* 2.1.4a — the Guide declares its job (verbatim) */}
            <Text style={styles.guideJobLine} testID="guide-job-line">
              patterns arrive with repetition. the guide is listening.
            </Text>
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

        {/* Your words, returning — the most recent capture, verbatim (§7) */}
        {mostRecent && (
          <View style={styles.returningWrap} testID="words-returning">
            <Text style={styles.returningLabel}>YOUR WORDS, RETURNING</Text>
            <Text style={styles.returningLine}>“{openingLine(mostRecent)}”</Text>
            <Text style={styles.returningMeta}>
              {mostRecent.type} · {SOURCE_LABEL[mostRecent.source] ?? mostRecent.source}
              {whenLabel(mostRecent) ? ` · ${whenLabel(mostRecent)}` : ""}
            </Text>
          </View>
        )}

        {/* Lenses — rendered, listening until Milestone D */}
        <Text style={styles.lensesLabel}>EXPLORE</Text>
        {LENSES.map((lens) => (
          <Pressable
            key={lens.id}
            style={({ pressed }) => [styles.lensRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              // Lens engine — Milestone D.
            }}
          >
            <View style={styles.lensLeft}>
              <View style={[styles.lensDot, { backgroundColor: lens.color }]} />
              <View style={styles.lensTextWrap}>
                <Text style={styles.lensName}>{lens.label}</Text>
                <Text style={styles.lensDesc}>listening.</Text>
                <Text style={styles.lensPromise}>{lens.promise}</Text>
              </View>
            </View>
            <Text style={styles.lensArrow}>→</Text>
          </Pressable>
        ))}

        {/* 2.1.4c — the Notes tab owns the archive; the Guide owns the
            mirror. Three freshest notes only, then a quiet link out. */}
        {hasField && (
          <View style={styles.feedSection}>
            <Text style={styles.lensesLabel}>FRESH</Text>
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
  fieldCount: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
  },
  guideJobLine: {
    ...TypeScale.serifSmall,
    lineHeight: 18,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  synthesisText: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(255,255,255,0.72)",
  },

  returningWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    marginBottom: 36,
  },
  returningLabel: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  returningLine: {
    ...TypeScale.serifSmall,
    lineHeight: 23,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },
  returningMeta: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },

  lensesLabel: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
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
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 3,
  },
  lensDesc: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
  },
  lensPromise: {
    ...TypeScale.serifSmall,
    lineHeight: 16,
    color: "rgba(255,255,255,0.5)",
    marginTop: 3,
  },
  lensArrow: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
    marginLeft: 8,
  },

  feedSection: {
    marginTop: 36,
  },
  noteItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  noteLine: {
    ...TypeScale.serifSmall,
    lineHeight: 20,
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
