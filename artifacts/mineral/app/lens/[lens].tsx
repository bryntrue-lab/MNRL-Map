import { router, useLocalSearchParams } from "expo-router";
import { collection, doc as fsDoc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkSecondary } from "@/components/Links";
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
  { pattern: PatternType; title: string; color: string }
> = {
  threads: { pattern: "thread", title: "your recurring language", color: "#88dcba" },
  motifs: { pattern: "motif", title: "mythic motifs", color: "#e9b76b" },
  resistance: { pattern: "resistance", title: "recurring resistance", color: "#e08aaf" },
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
  } | null>(null);

  // D.3 B9 — teaching scaffold: practitionerContent doc `teaching_{lens}`
  // (kind:'teaching'). No docs exist yet, so this renders nothing today.
  useEffect(() => {
    if (!user || !lens) return;
    getDoc(fsDoc(db, "practitionerContent", `teaching_${lens}`))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          kind?: string;
          heldLine?: string;
          paragraphs?: string[];
        };
        if (data.kind === "teaching") setTeaching(data);
      })
      .catch(() => {
        /* locked or absent — scaffold stays silent */
      });
  }, [user, lens]);

  useEffect(() => {
    if (!user || !meta) return;
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

        {lens === "resistance" && resistanceNoteCount > 0 && (
          <Text style={styles.countLine} testID="resistance-note-count">
            resistance · {resistanceNoteCount}{" "}
            {resistanceNoteCount === 1 ? "note" : "notes"}
          </Text>
        )}

        {rows.length === 0 ? (
          teaching ? null : (
            <Text style={styles.listening}>listening.</Text>
          )
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

        {/* B9 — teaching: below data on live lenses, replaces the empty
            state on quiet ones */}
        {teaching && (
          <View style={styles.teachingWrap} testID="lens-teaching">
            {teaching.heldLine ? (
              <Text style={styles.teachingHeld}>{teaching.heldLine}</Text>
            ) : null}
            {(teaching.paragraphs ?? []).map((p, i) => (
              <Text key={i} style={styles.teachingBody}>
                {p}
              </Text>
            ))}
          </View>
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
    ...TypeScale.metadata,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.6)",
  },

  // B9 — teaching scaffold
  teachingWrap: {
    marginTop: 36,
  },
  teachingHeld: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 16,
  },
  teachingBody: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 14,
  },
});
