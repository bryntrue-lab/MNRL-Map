import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { fetchFieldNotes, type FieldNoteWithId } from "@/lib/firestore";
import type { FieldNoteType } from "@/types/firestore";

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

// ── Chapel-voice formatting shared with the note rows and the Guide ──
export const TYPE_LABEL: Record<FieldNoteType, string> = {
  dream:         "dream",
  spark:         "spark",
  resistance:    "resistance",
  symbol:        "symbol",
  synchronicity: "synchronicity",
  vision:        "vision",
  desire:        "desire",
  fear:          "fear",
  other:         "other",
  reflection:    "reflection",
};

/** The verbatim opening line; audio-pending notes speak quietly instead. */
export function openingLine(note: FieldNoteWithId): string {
  if (note.content && note.content.trim().length > 0) {
    return note.content.trim().split(/\r?\n/)[0].trim();
  }
  if (note.captureMode === "audio") return "a voice note, arriving.";
  return "…";
}

/** A soft, unhurried relative label — timing, never progress. */
export function softTimeLabel(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "a minute ago" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "a month ago" : `${months} months ago`;
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [captureType, setCaptureType] = useState<FieldNoteType | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [recent, setRecent] = useState<FieldNoteWithId[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());

  const tabBarHeight = Platform.OS === "web" ? 84 : 60 + insets.bottom;

  const refresh = useCallback(() => {
    const uid = user?.uid;
    if (!uid) {
      setRecent([]);
      return;
    }
    setNow(new Date());
    fetchFieldNotes(uid, 30)
      .then(setRecent)
      .catch((err) => console.warn("recent feed unavailable", err));
  }, [user?.uid]);

  // Refresh on tab focus (§1f).
  useFocusEffect(useCallback(() => refresh(), [refresh]));

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
            {recent.length > 0 && (
              <Text style={styles.recentCount}>{recent.length} in your field</Text>
            )}
          </View>

          {recent.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {"your field is empty.\ntap a chip above to capture what's moving."}
              </Text>
            </View>
          ) : (
            recent.map((note) => {
              const created = note.createdAt?.toDate?.() ?? null;
              return (
                <View key={note.id} style={styles.noteItem}>
                  <Text style={styles.noteLine} numberOfLines={2}>
                    {openingLine(note)}
                  </Text>
                  <View style={styles.noteMeta}>
                    <Text style={styles.noteChip}>{TYPE_LABEL[note.type]}</Text>
                    <Text style={styles.noteTime}>
                      {created ? softTimeLabel(created, now) : "just now"}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <CaptureSheet
        open={captureType != null}
        onClose={() => {
          setCaptureType(null);
          // Refresh so a fresh capture appears in RECENT immediately (§1f).
          refresh();
        }}
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
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  noteLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 8,
  },
  noteMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noteChip: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  noteTime: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    color: "rgba(255,255,255,0.38)",
  },
});
