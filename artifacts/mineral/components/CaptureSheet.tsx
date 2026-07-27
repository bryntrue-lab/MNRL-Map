import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { SheetShell } from "@/components/OriginSheets";
import { FontFamily } from "@/constants/typography";
import { createFieldNote } from "@/lib/firestore";
import type { FieldNoteType, NoteSource, PhaseId } from "@/types/firestore";

// ─────────────────────────────────────────────────────────────
// The capture sheet — nine chips, one soft field. Shared verbatim
// between the Notes tab (spontaneous) and the encounter's ambient
// `+` (source 'encounter' + encounterRef, questionId stays null).
// ─────────────────────────────────────────────────────────────

export const CAPTURE_CHIPS: { id: FieldNoteType; label: string; glyph: string }[] = [
  { id: "dream",         label: "Dream",         glyph: "◐" },
  { id: "spark",         label: "Spark",         glyph: "✦" },
  { id: "resistance",    label: "Resistance",    glyph: "◬" },
  { id: "symbol",        label: "Symbol",        glyph: "◯" },
  { id: "synchronicity", label: "Synchronicity", glyph: "❋" },
  { id: "vision",        label: "Vision",        glyph: "⌖" },
  { id: "desire",        label: "Desire",        glyph: "✧" },
  { id: "fear",          label: "Fear",          glyph: "◭" },
  { id: "other",         label: "Other",         glyph: "⋯" },
];

interface CaptureSheetProps {
  open: boolean;
  onClose: () => void;
  uid: string | null;
  source: NoteSource;
  /** userEncounters doc id when capturing from inside an encounter. */
  encounterRef?: string | null;
  atmosphere: PhaseId;
  bottomPad: number;
  /** Preselect a chip (Notes tab chips open the sheet already chosen). */
  initialType?: FieldNoteType | null;
  onSaved?: () => void;
}

export function CaptureSheet({
  open,
  onClose,
  uid,
  source,
  encounterRef,
  atmosphere,
  bottomPad,
  initialType,
  onSaved,
}: CaptureSheetProps) {
  const [type, setType] = useState<FieldNoteType | null>(initialType ?? null);
  const [text, setText] = useState("");
  const busy = useRef(false);

  // Each opening starts fresh at the caller's preselection.
  useEffect(() => {
    if (open) {
      setType(initialType ?? null);
      setText("");
      busy.current = false;
    }
  }, [open, initialType]);

  const canKeep = type != null && text.trim().length > 0 && uid != null;

  const keep = async () => {
    if (!canKeep || busy.current || !uid || !type) return;
    busy.current = true;
    try {
      await createFieldNote(uid, {
        type,
        captureMode: "text",
        content: text.trim(),
        source,
        encounterRef: encounterRef ?? undefined,
        // questionId stays null — only the ⟡ capture carries one.
        atmosphere,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      console.warn("capture not kept", err);
      busy.current = false;
    }
  };

  return (
    <SheetShell open={open} onClose={onClose} bottomPad={bottomPad} testID="capture-sheet">
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>CAPTURE</Text>

        <View style={styles.chipRow}>
          {CAPTURE_CHIPS.map((chip) => {
            const active = chip.id === type;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setType(chip.id)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`capture-chip-${chip.id}`}
              >
                <Text style={[styles.chipGlyph, active && styles.chipGlyphActive]}>
                  {chip.glyph}
                </Text>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {type != null && (
          <>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="when you're ready"
              placeholderTextColor="rgba(255,255,255,0.28)"
              multiline
              autoFocus
              testID="capture-input"
            />
            <Pressable
              onPress={keep}
              style={[styles.keep, { opacity: canKeep ? 1 : 0.35 }]}
              testID="capture-keep"
            >
              <Text style={styles.keepText}>keep this →</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 440,
  },
  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.28)",
  },
  chipGlyph: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  chipGlyphActive: {
    color: "rgba(255,255,255,0.9)",
  },
  chipLabel: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.7)",
  },
  chipLabelActive: {
    color: "rgba(255,255,255,0.95)",
  },

  input: {
    minHeight: 96,
    maxHeight: 180,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.92)",
    textAlignVertical: "top",
  },

  keep: {
    alignSelf: "flex-end",
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  keepText: {
    fontFamily: FontFamily.sans500,
    fontSize: 13,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.85)",
  },
});
