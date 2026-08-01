import { onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { CaptureSheet } from "@/components/CaptureSheet";
import { QuietToast } from "@/components/OriginSheets";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { fieldNotesQuery, type FieldNoteWithId } from "@/lib/firestore";
import type { FieldNoteDoc, FieldNoteType } from "@/types/firestore";

const { width } = Dimensions.get("window");

const CHIPS: { id: FieldNoteType; label: string; glyph: string }[] = [
  { id: "dream",         label: "Dream",         glyph: "◐" },
  { id: "spark",         label: "Spark",         glyph: "✦" },
  { id: "resistance",    label: "Resistance",    glyph: "◬" },
  { id: "symbol",        label: "Symbol",        glyph: "◯" },
  { id: "synchronicity", label: "Synchronicity", glyph: "❋" },
  { id: "vision",        label: "Vision",        glyph: "⌖" },
];

const MORE_CHIPS: { id: FieldNoteType; label: string }[] = [
  { id: "desire", label: "DESIRE" },
  { id: "fear",   label: "FEAR" },
  { id: "other",  label: "OTHER" },
];

const RECENT_LIMIT = 30;

const NOTE_TYPE_LABEL: Record<string, string> = {
  dream: "dream",
  spark: "spark",
  resistance: "resistance",
  symbol: "symbol",
  synchronicity: "synchronicity",
  vision: "vision",
  desire: "desire",
  fear: "fear",
  other: "other",
  reflection: "reflection",
};

function noteOpeningLine(n: FieldNoteDoc): string {
  if (n.content) {
    const line = n.content.split("\n").find((l) => l.trim().length > 0);
    if (line) return line.trim();
  }
  if (n.captureMode === "audio") {
    return n.transcriptStatus === "pending" ? "spoken — words arriving…" : "spoken.";
  }
  return "kept.";
}

function noteWhenLabel(n: FieldNoteDoc): string {
  const created = n.createdAt?.toDate?.();
  if (!created) return "";
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [captureType, setCaptureType] = useState<FieldNoteType | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  // Chronological fieldNotes, createdAt DESC — live, so the feed
  // refreshes itself on capture, sheet close, and tab focus (§C.1 1f).
  const [recentNotes, setRecentNotes] = useState<FieldNoteWithId[]>([]);
  useEffect(() => {
    if (!user) {
      setRecentNotes([]);
      return;
    }
    const unsub = onSnapshot(
      fieldNotesQuery(user.uid),
      (snap) =>
        setRecentNotes(
          snap.docs
            .slice(0, RECENT_LIMIT)
            .map((d) => ({ id: d.id, ...(d.data() as FieldNoteDoc) }))
        ),
      (err) => console.warn("recent notes", err)
    );
    return unsub;
  }, [user]);

  const tabBarHeight = Platform.OS === "web" ? 84 : 60 + insets.bottom;

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
        <TabTopBar title="NOTES" rightIcon="⌕" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What's stirring?</Text>
          <Text style={styles.subtitle}>tap to capture a signal</Text>
        </View>

        {/* Capture chip grid */}
        <View style={styles.chipGrid}>
          {CHIPS.map((chip) => (
            <Pressable
              key={chip.id}
              style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setCaptureType(chip.id)}
              testID={`notes-chip-${chip.id}`}
            >
              <Text style={styles.glyph}>{chip.glyph}</Text>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* More row */}
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>MORE</Text>
          {MORE_CHIPS.map((chip) => (
            <React.Fragment key={chip.id}>
              <Text style={styles.moreLabel}> · </Text>
              <Pressable
                onPress={() => setCaptureType(chip.id)}
                hitSlop={10}
                testID={`notes-chip-${chip.id}`}
              >
                <Text style={styles.moreChip}>{chip.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Recent feed */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentLabel}>RECENT</Text>
            {recentNotes.length > 0 && (
              <Text style={styles.recentCount}>
                {recentNotes.length} in your field
              </Text>
            )}
          </View>

          {recentNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {"your field is empty.\ntap a chip above to capture what's moving."}
              </Text>
            </View>
          ) : (
            recentNotes.map((n) => (
              <View key={n.id} style={styles.noteItem} testID={`recent-note-${n.id}`}>
                <Text style={styles.noteLine} numberOfLines={2}>
                  {noteOpeningLine(n)}
                </Text>
                <Text style={styles.noteMeta}>
                  {NOTE_TYPE_LABEL[n.type] ?? n.type}
                  {noteWhenLabel(n) ? ` · ${noteWhenLabel(n)}` : ""}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <CaptureSheet
        open={captureType != null}
        onClose={() => setCaptureType(null)}
        uid={user?.uid ?? null}
        source="spontaneous"
        atmosphere={profile?.currentPhase ?? "signal"}
        bottomPad={tabBarHeight}
        initialType={captureType}
        onSaved={() => setToast({ key: Date.now(), text: "kept." })}
      />

      <QuietToast
        toast={toast}
        bottom={tabBarHeight + 24}
        onDone={() => setToast(null)}
      />
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

  header: {
    marginBottom: 28,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 26,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },

  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    width: (width - 56 - 16) / 3,
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 11,
    alignItems: "center",
  },
  glyph: {
    fontSize: 18,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 8,
    lineHeight: 22,
  },
  chipLabel: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
  },

  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: 24,
  },
  moreLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.35)",
  },
  moreChip: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.6)",
  },

  recentSection: {
    marginTop: 12,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  recentLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
  },
  recentCount: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },

  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },

  noteItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  noteLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  noteMeta: {
    fontFamily: FontFamily.sans400,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.4)",
  },
});
