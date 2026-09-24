import { onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  AppState,
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
import { NoteDetailSheet } from "@/components/NoteDetailSheet";
import { QuietToast } from "@/components/OriginSheets";
import TabTopBar from "@/components/TabTopBar";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
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

type NoteDayGroup = {
  key: string;
  label: string | null;
  dayStart: number;
  notes: FieldNoteWithId[];
};

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayHeaderLabel(dayStart: number, now: Date): string {
  const todayStart = startOfLocalDay(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (dayStart === todayStart) return "today";
  if (dayStart === yesterday.getTime()) return "yesterday";

  const date = new Date(dayStart);
  const dateLabel = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear()
    ? dateLabel
    : `${dateLabel} ${date.getFullYear()}`;
}

function groupNotesByLocalDay(
  notes: FieldNoteWithId[],
  now: Date
): NoteDayGroup[] {
  const pending: FieldNoteWithId[] = [];
  const groups = new Map<number, FieldNoteWithId[]>();

  notes.forEach((note) => {
    const created = note.createdAt?.toDate?.();
    if (!created) {
      pending.push(note);
      return;
    }

    const dayStart = startOfLocalDay(created);
    const dayNotes = groups.get(dayStart);
    if (dayNotes) {
      dayNotes.push(note);
    } else {
      groups.set(dayStart, [note]);
    }
  });

  const datedGroups = Array.from(groups.entries())
    .sort(([a], [b]) => b - a)
    .map(([dayStart, dayNotes]) => ({
      key: String(dayStart),
      label: dayHeaderLabel(dayStart, now),
      dayStart,
      notes: dayNotes,
    }));

  return pending.length > 0
    ? [
        {
          key: "pending",
          label: null,
          dayStart: Number.POSITIVE_INFINITY,
          notes: pending,
        },
        ...datedGroups,
      ]
    : datedGroups;
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [captureType, setCaptureType] = useState<FieldNoteType | null>(null);
  // Slice J — tapped-open note. Held as a copy that live snapshot updates
  // refresh while the note remains in the field, so an edit flows straight
  // into the open sheet.
  const [openNote, setOpenNote] = useState<FieldNoteWithId | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [activeType, setActiveType] = useState<FieldNoteType | null>(null);
  const [calendarNow, setCalendarNow] = useState(() => Date.now());

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
            .map((d) => ({ id: d.id, ...(d.data() as FieldNoteDoc) }))
        ),
      (err) => console.warn("recent notes", err)
    );
    return unsub;
  }, [user]);

  // Keep the open sheet's copy fresh while the note remains in the field.
  useEffect(() => {
    setOpenNote((prev) => {
      if (!prev) return prev;
      const live = recentNotes.find((n) => n.id === prev.id);
      return live ?? prev;
    });
  }, [recentNotes]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    ).getTime();
    const midnightTimer = setTimeout(
      () => setCalendarNow(Date.now()),
      nextMidnight - now.getTime() + 50
    );
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setCalendarNow(Date.now());
    });

    return () => {
      clearTimeout(midnightTimer);
      appStateSubscription.remove();
    };
  }, [calendarNow]);

  const existingTypes = useMemo(
    () => Array.from(new Set(recentNotes.map((note) => note.type))),
    [recentNotes]
  );

  useEffect(() => {
    if (activeType && !existingTypes.includes(activeType)) {
      setActiveType(null);
    }
  }, [activeType, existingTypes]);

  const selectedType =
    activeType && existingTypes.includes(activeType) ? activeType : null;
  const visibleNotes = useMemo(
    () =>
      selectedType
        ? recentNotes.filter((note) => note.type === selectedType)
        : recentNotes,
    [recentNotes, selectedType]
  );
  const noteGroups = useMemo(
    () => groupNotesByLocalDay(visibleNotes, new Date(calendarNow)),
    [calendarNow, visibleNotes]
  );

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
            <>
              <View style={styles.filterRow}>
                {existingTypes.map((type, index) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityLabel={NOTE_TYPE_LABEL[type] ?? type}
                    accessibilityState={{ selected: selectedType === type }}
                    onPress={() =>
                      setActiveType((current) => current === type ? null : type)
                    }
                    hitSlop={6}
                    testID={`notes-filter-${type}`}
                  >
                    <Text
                      style={[
                        styles.filterLabel,
                        selectedType === type && styles.filterLabelActive,
                      ]}
                    >
                      {`${index > 0 ? " · " : ""}${NOTE_TYPE_LABEL[type] ?? type}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {noteGroups.map((group, groupIndex) => (
                <View
                  key={group.key}
                  style={groupIndex > 0 ? styles.laterDayGroup : undefined}
                >
                  {group.label && (
                    <Text style={styles.dayHeader}>{group.label}</Text>
                  )}
                  {group.notes.map((n) => (
                    <Pressable
                      key={n.id}
                      style={styles.noteItem}
                      onPress={() => setOpenNote(n)}
                      testID={`recent-note-${n.id}`}
                    >
                      <Text style={styles.noteLine} numberOfLines={2}>
                        {noteOpeningLine(n)}
                      </Text>
                      <Text style={styles.noteMeta}>
                        {NOTE_TYPE_LABEL[n.type] ?? n.type}
                        {noteWhenLabel(n) ? ` · ${noteWhenLabel(n)}` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
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

      <NoteDetailSheet
        note={openNote}
        uid={user?.uid ?? null}
        onClose={() => setOpenNote(null)}
        bottomPad={tabBarHeight}
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
    ...TypeScale.display,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  subtitle: {
    ...TypeScale.serifSmall,
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
    ...TypeScale.sectionTitle,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 8,
  },
  chipLabel: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.85)",
  },

  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: 24,
  },
  moreLabel: {
    ...TypeScale.micro,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
  },
  moreChip: {
    ...TypeScale.micro,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.58)",
  },

  recentSection: {
    // T-c follow-up §3: section heads get ≥32pt above
    marginTop: 32,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  // T-c follow-up §3: section head, not an eyebrow
  recentLabel: {
    ...TypeScale.sectionTitle,
    textTransform: "lowercase",
    color: colors.light.textSecondary,
  },
  recentCount: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 12,
  },
  filterLabel: {
    ...TypeScale.label,
    color: colors.light.textTertiary,
    textTransform: "lowercase",
  },
  filterLabelActive: {
    color: colors.light.textPrimary,
  },
  laterDayGroup: {
    marginTop: 28,
  },
  dayHeader: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: colors.light.textMuted,
    textTransform: "lowercase",
  },

  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
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
});
