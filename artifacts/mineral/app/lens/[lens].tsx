import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { collection, doc as fsDoc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkSecondary, LinkWhisper } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { fieldNotesQuery } from "@/lib/firestore";
import type {
  ExemplarEntry,
  FieldNoteDoc,
  PatternDoc,
  PatternType,
} from "@/types/firestore";

// Task D §2 — full lens views. The engine's counts, quoted verbatim,
// attributed `type · source · relative time`. Nothing interpretive.

const SOURCE_LABEL: Record<string, string> = {
  encounter: "the threshold",
  spontaneous: "the field",
};

const LENS_META: Record<
  string,
  { pattern: PatternType | null; title: string; color: string }
> = {
  threads: { pattern: "thread", title: "your recurring language", color: "#88dcba" },
  motifs: { pattern: "motif", title: "mythic motifs", color: "#e9b76b" },
  resistance: { pattern: "resistance", title: "recurring resistance", color: "#e08aaf" },
  // Quiet lenses (no engine yet) — the teaching IS the content. When
  // their engines ship, data sections appear above with no nav change.
  conditions: { pattern: null, title: "conditions", color: "#9bb6d6" },
  consciousness: { pattern: null, title: "consciousness", color: "#c4baea" },
};

function attribution(e: ExemplarEntry): string {
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

export default function LensScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lens } = useLocalSearchParams<{ lens: string }>();
  const meta = LENS_META[lens ?? ""];

  const [doc, setDoc] = useState<PatternDoc | null>(null);
  const [resistanceNoteCount, setResistanceNoteCount] = useState(0);
  const [teaching, setTeaching] = useState<{
    heldLine?: string;
    paragraphs?: string[];
    closingParagraphIndex?: number;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const firstVisitLens = useRef<string | null>(null);

  // B9 AMENDED — teachings render as a sheet, not inline. Doc:
  // practitionerContent/teaching_{lens} (kind:'teaching').
  useEffect(() => {
    if (!user || !lens) return;
    getDoc(fsDoc(db, "practitionerContent", `teaching_${lens}`))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          kind?: string;
          heldLine?: string;
          paragraphs?: string[];
          closingParagraphIndex?: number;
        };
        if (data.kind === "teaching") setTeaching(data);
      })
      .catch(() => {
        /* locked or absent — everything renders as today */
      });
  }, [user, lens]);

  // First visit per lens: the sheet presents itself once (after the view
  // settles), then never again uninvited — the map-label doctrine.
  useEffect(() => {
    if (!teaching || !lens || firstVisitLens.current === lens) return;
    firstVisitLens.current = lens;
    const key = `mineral_teaching_seen_${lens}`;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (seen !== null || cancelled) return;
        timer = setTimeout(() => {
          if (cancelled) return;
          // The flag commits only when the presentation actually begins.
          setSheetOpen(true);
          AsyncStorage.setItem(key, "1").catch(() => {});
        }, 700);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [teaching, lens]);

  useEffect(() => {
    if (!user || !meta?.pattern) return;
    const unsubPatterns = onSnapshot(
      collection(db, "users", user.uid, "patterns"),
      (snap) => {
        const found = snap.docs.find((d) => d.id === meta.pattern);
        setDoc(found ? (found.data() as PatternDoc) : null);
      },
      (err) => console.warn("lens patterns", err)
    );
    const unsubNotes =
      lens === "resistance"
        ? onSnapshot(
            fieldNotesQuery(user.uid),
            (snap) =>
              setResistanceNoteCount(
                snap.docs.filter(
                  (d) => (d.data() as FieldNoteDoc).type === "resistance"
                ).length
              ),
            (err) => console.warn("lens notes", err)
          )
        : null;
    return () => {
      unsubPatterns();
      unsubNotes?.();
    };
  }, [user, meta, lens]);

  // Ordering per §2: threads — items ≥ 3, phrases before single words,
  // top 7 by count. motifs/resistance — items ≥ 1, count-ordered.
  const rows = useMemo(() => {
    const counts = doc?.itemCounts ?? {};
    const entries = Object.entries(counts);
    if (lens === "threads") {
      const established = entries.filter(([, c]) => c >= 3);
      const phrases = established
        .filter(([item]) => item.includes(" "))
        .sort((a, b) => b[1] - a[1]);
      const words = established
        .filter(([item]) => !item.includes(" "))
        .sort((a, b) => b[1] - a[1]);
      return [...phrases, ...words].slice(0, 7);
    }
    return entries.sort((a, b) => b[1] - a[1]);
  }, [doc, lens]);

  if (!meta) return null;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinkSecondary
          label="← the guide"
          onPress={() => router.back()}
          style={styles.backLink}
          testID="lens-back"
        />

        <View style={styles.titleRow}>
          <View style={[styles.lensDot, { backgroundColor: meta.color }]} />
          <Text style={styles.title}>{meta.title}</Text>
        </View>

        {/* Inline, always — the held line only */}
        {teaching?.heldLine ? (
          <Text style={styles.heldLine} testID="lens-held-line">
            {teaching.heldLine}
          </Text>
        ) : null}

        {lens === "resistance" && resistanceNoteCount > 0 && (
          <Text style={styles.countLine} testID="resistance-note-count">
            resistance · {resistanceNoteCount}{" "}
            {resistanceNoteCount === 1 ? "note" : "notes"}
          </Text>
        )}

        {rows.length === 0 ? (
          teaching?.paragraphs ? (
            // Quiet lens — the closing paragraph(s) replace the old
            // promise/empty line. Nothing else renders inline.
            <View style={styles.closingWrap} testID="lens-closing">
              {teaching.paragraphs
                .slice(teaching.closingParagraphIndex ?? teaching.paragraphs.length - 1)
                .map((p, i) => (
                  <Text key={i} style={styles.teachingBody}>
                    {p}
                  </Text>
                ))}
            </View>
          ) : meta.pattern !== null ? (
            <Text style={styles.listening}>listening.</Text>
          ) : null
        ) : (
          rows.map(([item, count]) => {
            const exemplars = doc?.exemplars?.[item] ?? [];
            const offering = doc?.offerings?.[item];
            return (
              <View key={item} style={styles.itemBlock} testID={`lens-item-${item}`}>
                <Text style={styles.itemLine}>
                  {item} · <Text style={styles.itemCount}>{count} {count === 1 ? "note" : "notes"}</Text>
                </Text>
                {exemplars.map((e, i) => (
                  <View key={`${e.fieldNoteId}-${i}`} style={styles.exemplarWrap}>
                    <Text style={styles.exemplarText}>“{e.text}”</Text>
                    <Text style={styles.exemplarMeta}>{attribution(e)}</Text>
                  </View>
                ))}
                {offering && (
                  <View style={styles.offeringWrap} testID={`offering-${item}`}>
                    <Text style={styles.offeringLabel}>FROM THE FIELD</Text>
                    <Text style={styles.offeringText}>{offering.text}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* The full teaching lives in a sheet, summoned on request */}
        {teaching && (
          <LinkWhisper
            label="the teaching"
            onPress={() => setSheetOpen(true)}
            style={styles.teachingLink}
            testID="lens-teaching-link"
          />
        )}
      </ScrollView>

      {teaching && (
        <SheetShell
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          bottomPad={insets.bottom}
          swipeToDismiss
          modal
          testID="teaching-sheet"
        >
          <ScrollView
            style={{ maxHeight: Dimensions.get("window").height * 0.62 }}
            showsVerticalScrollIndicator={false}
          >
            {teaching.heldLine ? (
              <Text style={styles.teachingHeld}>{teaching.heldLine}</Text>
            ) : null}
            {(teaching.paragraphs ?? []).map((p, i) => (
              <Text key={i} style={styles.teachingBody}>
                {p}
              </Text>
            ))}
          </ScrollView>
        </SheetShell>
      )}
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
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  lensDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  title: {
    ...TypeScale.serifTitle,
    color: "rgba(255,255,255,0.92)",
  },
  countLine: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },
  listening: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
    marginTop: 24,
  },

  itemBlock: {
    marginTop: 28,
  },
  itemLine: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 10,
  },
  itemCount: {
    color: "rgba(255,255,255,0.5)",
  },
  exemplarWrap: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.12)",
    marginBottom: 10,
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

  // Offering — lower-opacity sans container, passive voice (style guide)
  offeringWrap: {
    marginTop: 4,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  offeringLabel: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 6,
  },
  offeringText: {
    ...TypeScale.body,
    color: colors.light.textTertiary,
  },

  // B9 AMENDED — teaching presence
  heldLine: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
    marginTop: 14,
  },
  closingWrap: {
    marginTop: 28,
  },
  teachingLink: {
    alignSelf: "flex-start",
    marginTop: 36,
  },
  teachingHeld: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 20,
  },
  teachingBody: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 16,
  },
});
