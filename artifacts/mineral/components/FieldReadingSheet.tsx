import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";

import { SheetShell } from "@/components/OriginSheets";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { db, functions } from "@/lib/firebase";
import { spellNumber } from "@/lib/patternText";

type ReadingSpan = {
  text: string;
  quote: boolean;
};

type ReadingDoc = {
  paragraphs: { spans: ReadingSpan[] }[];
  question: string;
  createdAt: Timestamp;
  noteCount: number;
};

type ReadingWithId = ReadingDoc & { id: string };
type ReadingState =
  | { kind: "pending" }
  | { kind: "reading"; reading: ReadingWithId; resting: boolean }
  | { kind: "failed" };

const MONTHS = [
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
];

function readingDate(reading: ReadingDoc): string {
  const date = reading.createdAt?.toDate?.();
  if (!date) return `${spellNumber(reading.noteCount)} notes`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()} · ${spellNumber(
    reading.noteCount
  )} notes`;
}

async function latestReading(uid: string): Promise<ReadingWithId | null> {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "readings"),
      orderBy("createdAt", "desc"),
      limit(1)
    )
  );
  const first = snap.docs[0];
  return first
    ? { id: first.id, ...(first.data() as ReadingDoc) }
    : null;
}

function isWithinReadingRest(reading: ReadingDoc): boolean {
  const createdMs = reading.createdAt?.toMillis?.() ?? 0;
  return createdMs > 0 && Date.now() - createdMs < 20 * 60 * 60 * 1000;
}

interface FieldReadingSheetProps {
  open: boolean;
  uid: string | null;
  onClose: () => void;
  bottomPad: number;
}

export function FieldReadingSheet({
  open,
  uid,
  onClose,
  bottomPad,
}: FieldReadingSheetProps) {
  const [state, setState] = useState<ReadingState>({ kind: "pending" });

  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    setState({ kind: "pending" });

    const run = async () => {
      try {
        const stored = await latestReading(uid);
        if (cancelled) return;

        // Re-opening during the server's 20-hour rest window is read-only:
        // display the stored reading and never invoke generation.
        if (stored && isWithinReadingRest(stored)) {
          setState({ kind: "reading", reading: stored, resting: true });
          return;
        }

        const callable = httpsCallable<undefined, { id: string }>(
          functions,
          "requestReading"
        );
        const result = await callable();
        if (cancelled) return;
        const createdSnap = await getDoc(
          doc(db, "users", uid, "readings", result.data.id)
        );
        if (!createdSnap.exists()) throw new Error("reading document missing");
        setState({
          kind: "reading",
          reading: {
            id: createdSnap.id,
            ...(createdSnap.data() as ReadingDoc),
          },
          resting: false,
        });
      } catch (error) {
        if (cancelled) return;
        const code = (error as { code?: string }).code ?? "";
        if (code.endsWith("resource-exhausted")) {
          try {
            const stored = await latestReading(uid);
            if (!cancelled && stored) {
              setState({ kind: "reading", reading: stored, resting: true });
              return;
            }
          } catch {}
        }
        if (!cancelled) setState({ kind: "failed" });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [open, uid]);

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      bottomPad={bottomPad}
      swipeToDismiss
      modal
      testID="field-reading-sheet"
    >
      {state.kind === "pending" ? (
        <Text style={styles.pending} testID="field-reading-pending">
          reading your field…
        </Text>
      ) : state.kind === "failed" ? (
        <Text style={styles.failed} testID="field-reading-failed">
          the reading didn't arrive — ask again.
        </Text>
      ) : (
        <ScrollView
          style={{ maxHeight: Dimensions.get("window").height * 0.62 }}
          showsVerticalScrollIndicator={false}
          testID="field-reading-content"
        >
          {state.resting ? (
            <Text style={styles.resting}>the field rests until tomorrow.</Text>
          ) : null}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>A READING</Text>
            <Text style={styles.date}>{readingDate(state.reading)}</Text>
          </View>

          <View>
            {state.reading.paragraphs.map((paragraph, paragraphIndex) => (
              <Text key={paragraphIndex} style={styles.paragraph}>
                {paragraph.spans.map((span, spanIndex) => (
                  <Text
                    key={spanIndex}
                    style={span.quote ? styles.quote : undefined}
                  >
                    {span.text}
                  </Text>
                ))}
              </Text>
            ))}
          </View>

          {state.reading.question ? (
            <Text style={styles.question}>{state.reading.question}</Text>
          ) : null}
        </ScrollView>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  pending: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
  },
  failed: {
    ...TypeScale.metadata,
    letterSpacing: 1,
    color: colors.light.signalText,
  },
  resting: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
    marginBottom: 20,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    ...TypeScale.eyebrow,
    color: colors.light.textMuted,
  },
  date: {
    ...TypeScale.metadata,
    color: colors.light.textMuted,
    marginTop: 5,
  },
  paragraph: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 16,
  },
  quote: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.85)",
  },
  question: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.85)",
    marginTop: 18,
    marginBottom: 8,
  },
});