import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { collection, doc as fsDoc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { FieldPassageSheet } from "@/components/FieldPassageSheet";
import { LinkSecondary, LinkWhisper } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { firstApprovedFieldPassage } from "@/lib/fieldPassages";
import { fieldNotesQuery } from "@/lib/firestore";
import { ageAt, resolve } from "@/lib/spiral";
import { spellNumber } from "@/lib/patternText";
import type {
  ConditionFinding,
  ConsciousnessStructure,
  ExemplarEntry,
  FieldNoteDoc,
  PatternDoc,
  PatternType,
  PractitionerContentDoc,
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
  conditions: { pattern: "conditions", title: "conditions", color: "#9bb6d6" },
  consciousness: { pattern: "consciousness", title: "consciousness", color: "#c4baea" },
};

const TYPE_PLURALS: Record<string, string> = {
  dream: "dreams",
  spark: "sparks",
  resistance: "resistances",
  symbol: "symbols",
  synchronicity: "synchronicities",
  vision: "visions",
  desire: "desires",
  fear: "fears",
  other: "others",
  reflection: "reflections",
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

function conditionCopy(finding: ConditionFinding): { line: string; evidence: string } | null {
  if (finding.kind === "gap") {
    return {
      line: `the ${TYPE_PLURALS[finding.type] ?? `${finding.type}s`} come after quiet`,
      evidence: `${spellNumber(finding.matchingCount)} arrived after a day away`,
    };
  }
  if (finding.type === "resistance" && finding.bucket === "night") {
    return {
      line: "resistance arrives at night",
      evidence: `${spellNumber(finding.matchingCount)} of ${spellNumber(finding.totalWithHour)} walls · named after nine`,
    };
  }
  if (finding.type === "reflection" && finding.bucket === "morning") {
    return {
      line: "reflection belongs to your mornings",
      evidence: `${spellNumber(finding.matchingCount)} of ${spellNumber(finding.totalWithHour)} · before ten`,
    };
  }
  // Detection is broader than founder-approved language. This should remain
  // unreachable for the current engine output, and protects future data.
  return null;
}

export default function LensScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();
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
  const [fieldPassageItem, setFieldPassageItem] = useState<string | null>(null);
  const [motifPassageContent, setMotifPassageContent] = useState<
    Record<string, PractitionerContentDoc | null>
  >({});
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

  // G2 — only the currently visible mythic motifs are observed. This keeps
  // founder approvals live while never asking clients to read the prompt doc.
  const motifKeys = useMemo(
    () => (lens === "motifs" ? rows.map(([item]) => item) : []),
    [lens, rows]
  );
  useEffect(() => {
    if (lens !== "motifs") {
      setMotifPassageContent({});
      setFieldPassageItem(null);
      return;
    }
    setMotifPassageContent(
      Object.fromEntries(motifKeys.map((key) => [key, null])) as Record<
        string,
        PractitionerContentDoc | null
      >
    );
    return () => {};
  }, [lens, motifKeys]);
  useEffect(() => {
    if (lens !== "motifs") return;
    const unsubscribes = motifKeys.map((key) =>
      onSnapshot(
        fsDoc(db, "practitionerContent", `motif_${key}`),
        (snap) =>
          setMotifPassageContent((current) => ({
            ...current,
            [key]: snap.exists() ? (snap.data() as PractitionerContentDoc) : null,
          })),
        () =>
          setMotifPassageContent((current) => ({
            ...current,
            [key]: null,
          }))
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [lens, motifKeys]);
  const selectedPassageContent = fieldPassageItem
    ? motifPassageContent[fieldPassageItem] ?? null
    : null;

  const consciousnessRows = useMemo(
    () =>
      Object.entries(doc?.structureCounts ?? {})
        .filter(([, count]) => count > 0)
        .sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName)) as [
        ConsciousnessStructure,
        number,
      ][],
    [doc]
  );
  const consciousnessMax = consciousnessRows[0]?.[1] ?? 0;
  const consciousnessExemplar = lens === "consciousness" ? doc?.exemplar ?? null : null;
  const leading = lens === "consciousness" ? doc?.leading ?? null : null;
  const conditions = useMemo(
    () =>
      lens === "conditions"
        ? (doc?.findings ?? [])
            .map(conditionCopy)
            .filter((finding): finding is { line: string; evidence: string } => finding !== null)
        : [],
    [doc, lens]
  );
  const birthDate = profile?.birthDate?.toDate?.();
  const mapStructure = useMemo(
    () => (birthDate ? resolve(ageAt(birthDate, new Date())).station.structure.toLowerCase() : null),
    [birthDate]
  );
  const quietLensHasData =
    (lens === "consciousness" && consciousnessRows.length > 0) ||
    (lens === "conditions" && conditions.length > 0);

  if (!meta) return null;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
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

        {lens === "consciousness" && consciousnessRows.length > 0 ? (
          <>
            <Text style={styles.countLine} testID="consciousness-notes-read">
              {spellNumber(doc?.notesRead ?? 0)} {doc?.notesRead === 1 ? "note" : "notes"} read
            </Text>
            <View style={styles.spectrum} testID="consciousness-spectrum">
              {consciousnessRows.map(([structure, count], index) => (
                <View key={structure} style={styles.spectrumRow}>
                  <View style={styles.spectrumLabelRow}>
                    <Text style={styles.spectrumName}>{structure}</Text>
                    <Text style={styles.spectrumCount}>
                      {spellNumber(count)} {count === 1 ? "note" : "notes"}
                    </Text>
                  </View>
                  <View style={styles.spectrumTrack}>
                    <View
                      style={[
                        styles.spectrumFill,
                        {
                          width: `${(count / consciousnessMax) * 100}%`,
                          opacity: [0.55, 0.42, 0.34, 0.28][index] ?? 0.28,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
            {consciousnessExemplar ? (
              <View style={styles.consciousnessExemplar} testID="consciousness-exemplar">
                <Text style={styles.exemplarText}>“{consciousnessExemplar.text}”</Text>
                <Text style={styles.exemplarMeta}>
                  {leading ? `${leading} · ` : ""}{attribution(consciousnessExemplar)}
                </Text>
              </View>
            ) : null}
            {leading && mapStructure ? (
              <Text style={styles.mirrorLine} testID="consciousness-mirror">
                {mapStructure === leading
                  ? `the map and your words stand together in the ${leading}.`
                  : `the map holds this year in the ${mapStructure}. your words answer from the ${leading}.`}
              </Text>
            ) : null}
          </>
        ) : lens === "conditions" && conditions.length > 0 ? (
          <>
            <Text style={styles.countLine} testID="conditions-notes-read">
              {spellNumber(doc?.notesRead ?? 0)} {doc?.notesRead === 1 ? "note" : "notes"} ·{" "}
              {spellNumber(doc?.daysRead ?? 0)} {doc?.daysRead === 1 ? "day" : "days"}
            </Text>
            <View style={styles.conditionsList} testID="conditions-findings">
              {conditions.map((finding, index) => (
                <View key={`${finding.line}-${index}`} style={styles.conditionFinding}>
                  <Text style={styles.conditionLine}>{finding.line}</Text>
                  <Text style={styles.conditionEvidence}>{finding.evidence}</Text>
                </View>
              ))}
            </View>
          </>
        ) : rows.length === 0 ? (
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
          ) : meta.pattern !== null && !quietLensHasData ? (
            <Text style={styles.listening}>listening.</Text>
          ) : null
        ) : (
          rows.map(([item, count]) => {
            const exemplars = doc?.exemplars?.[item] ?? [];
            const offering = doc?.offerings?.[item];
            const fieldContent = motifPassageContent[item] ?? null;
            const approvedPassage = firstApprovedFieldPassage(fieldContent);
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
                {approvedPassage ? (
                  <Pressable
                    style={({ pressed }) => [styles.offeringWrap, pressed && styles.offeringPressDim]}
                    onPress={() => setFieldPassageItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`More from the field: ${item}`}
                    testID={`field-passage-card-${item}`}
                  >
                    <Text style={styles.offeringLabel}>FROM THE FIELD</Text>
                    <Text style={styles.offeringText}>{approvedPassage.text}</Text>
                    <Text style={styles.offeringMore}>more from the field →</Text>
                  </Pressable>
                ) : offering ? (
                  <View style={styles.offeringWrap} testID={`offering-${item}`}>
                    <Text style={styles.offeringLabel}>FROM THE FIELD</Text>
                    <Text style={styles.offeringText}>{offering.text}</Text>
                  </View>
                ) : null}
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
            contentContainerStyle={styles.teachingSheetContent}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
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
      <FieldPassageSheet
        open={fieldPassageItem !== null}
        onClose={() => setFieldPassageItem(null)}
        bottomPad={insets.bottom}
        motifName={fieldPassageItem ?? ""}
        content={selectedPassageContent}
        exemplars={fieldPassageItem ? doc?.exemplars?.[fieldPassageItem] ?? [] : []}
        attribution={attribution}
        testID="lens-field-passage-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#050208",
  },
  scrollContent: {
    flexGrow: 1,
    paddingLeft: 28,
    paddingRight: 32,
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
    flexShrink: 1,
  },
  countLine: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
    flexShrink: 1,
  },
  spectrum: {
    marginTop: 32,
    gap: 18,
  },
  spectrumRow: {
    gap: 7,
  },
  spectrumLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  spectrumName: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    flexShrink: 1,
  },
  spectrumCount: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
    flexShrink: 0,
  },
  spectrumTrack: {
    height: 1.5,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  spectrumFill: {
    height: 1.5,
    backgroundColor: "#c4baea",
  },
  consciousnessExemplar: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255,255,255,0.12)",
    marginTop: 30,
  },
  mirrorLine: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
    marginTop: 34,
  },
  conditionsList: {
    marginTop: 34,
    gap: 30,
  },
  conditionFinding: {
    gap: 4,
  },
  conditionLine: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
  },
  conditionEvidence: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
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
  offeringMore: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
  },
  offeringPressDim: {
    opacity: 0.72,
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
    flexShrink: 1,
  },
  teachingSheetContent: {
    paddingBottom: 28,
  },
});
