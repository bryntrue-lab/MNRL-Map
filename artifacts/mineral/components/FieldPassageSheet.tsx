import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";

import { SheetShell } from "@/components/OriginSheets";
import { TypeScale } from "@/constants/typography";
import { approvedFieldPassages } from "@/lib/fieldPassages";
import type { ExemplarEntry, PractitionerContentDoc } from "@/types/firestore";

interface FieldPassageSheetProps {
  open: boolean;
  onClose: () => void;
  bottomPad: number;
  motifName: string;
  content: Pick<PractitionerContentDoc, "passages"> | null;
  exemplars: ExemplarEntry[];
  attribution: (exemplar: ExemplarEntry) => string;
  testID: string;
}

/** Shared G2 teaching sheet for a motif's approved passages and field words. */
export function FieldPassageSheet({
  open,
  onClose,
  bottomPad,
  motifName,
  content,
  exemplars,
  attribution,
  testID,
}: FieldPassageSheetProps) {
  // Keep the approval boundary in the view itself as well as at each caller.
  const passages = approvedFieldPassages(content);
  if (passages.length === 0) return null;

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      bottomPad={bottomPad}
      swipeToDismiss
      modal
      testID={testID}
    >
      <ScrollView
        style={{ maxHeight: Dimensions.get("window").height * 0.7 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{motifName}</Text>
        {passages.map((passage, index) => (
          <View key={`${passage.text}-${index}`} style={styles.passage} testID={`${testID}-passage-${index}`}>
            <Text style={styles.passageText}>{passage.text}</Text>
            {passage.locator ? <Text style={styles.locator}>{passage.locator}</Text> : null}
          </View>
        ))}
        <View style={styles.fieldSection}>
          <Text style={styles.eyebrow}>IN YOUR FIELD</Text>
          {exemplars.map((exemplar, index) => (
            <View key={`${exemplar.fieldNoteId}-${index}`} style={styles.exemplar}>
              <Text style={styles.exemplarText}>“{exemplar.text}”</Text>
              <Text style={styles.exemplarMeta}>{attribution(exemplar)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  title: {
    ...TypeScale.serifTitle,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 24,
  },
  passage: {
    marginBottom: 24,
  },
  passageText: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.72)",
  },
  locator: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 7,
  },
  fieldSection: {
    marginTop: 4,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.09)",
  },
  eyebrow: {
    ...TypeScale.metadata,
    letterSpacing: 2.4,
    color: "rgba(200,190,225,0.5)",
    marginBottom: 14,
  },
  exemplar: {
    marginBottom: 18,
  },
  exemplarText: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 4,
  },
  exemplarMeta: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
  },
});