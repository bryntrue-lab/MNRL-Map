import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LinkPrimary } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import { TypeScale } from "@/constants/typography";
import { createFieldNote } from "@/lib/firestore";
import type { FieldNoteType, NoteSource, PhaseId } from "@/types/firestore";
import type { CreateFieldNoteInput } from "@/lib/firestore";

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
  /** §6 counterweight capture — the type is fixed and the chips stay hidden. */
  lockedType?: FieldNoteType | null;
  /** §6 additive v1.8 — which map position provoked this capture. */
  mapRef?: CreateFieldNoteInput["mapRef"];
  /** Header eyebrow. Defaults to CAPTURE; the counterweight names itself. */
  eyebrow?: string;
  /**
   * What is being kept — held above the field and never scrolled away.
   * Losing the date and the question behind the sheet was the substance of
   * the first tester's complaint: "would have liked to still be able to see
   * the date in question."
   */
  contextDate?: string | null;
  promptText?: string | null;
  /** Cover navigator siblings (the tab bar) while the sheet is up. */
  modal?: boolean;
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
  lockedType,
  mapRef,
  eyebrow = "CAPTURE",
  contextDate,
  promptText,
  modal,
  onSaved,
}: CaptureSheetProps) {
  const [type, setType] = useState<FieldNoteType | null>(lockedType ?? initialType ?? null);
  const [text, setText] = useState("");
  const busy = useRef(false);
  const inputRef = useRef<TextInput>(null);

  // Each opening starts fresh at the caller's preselection.
  useEffect(() => {
    if (open) {
      setType(lockedType ?? initialType ?? null);
      setText("");
      busy.current = false;
    }
  }, [open, initialType, lockedType]);

  // 2.1.2 — focus only after the slide-in settles (420ms). Focusing
  // mid-entrance made the scroll-into-view fight the animation, leaving
  // the field clipped at the sheet's top edge.
  useEffect(() => {
    if (!open || type == null) return;
    const t = setTimeout(() => inputRef.current?.focus(), 460);
    return () => clearTimeout(t);
  }, [open, type]);

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
        mapRef: mapRef ?? null,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      console.warn("capture not kept", err);
      busy.current = false;
    }
  };

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      bottomPad={bottomPad}
      swipeToDismiss
      modal={modal}
      testID="capture-sheet"
    >
      {/* 2.1.3 — the header sits OUTSIDE the scroll view. Inside it, the ✕
          scrolled out of reach the moment the keyboard raised the field, so
          the only visible ✕ was the encounter screen's own exit — which quit
          the encounter rather than the sheet. That is the whole of the
          tester's "the x is cut off" and "it took me back to Today". */}
      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Pressable onPress={onClose} style={styles.closeTarget} hitSlop={8} testID="capture-close">
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        style={[styles.scroll, lockedType != null && styles.lockedScroll]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {/* Context yields vertical space first; the input dock below never does. */}
        {(contextDate || promptText) && (
          <View style={styles.context} testID="capture-context">
            {contextDate ? <Text style={styles.contextDate}>{contextDate}</Text> : null}
            {promptText ? <Text style={styles.contextPrompt}>{promptText}</Text> : null}
          </View>
        )}

        {lockedType == null && (
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
        )}

      </KeyboardAwareScrollViewCompat>

      {type != null && (
        <View style={styles.inputDock}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="when you're ready"
            placeholderTextColor="rgba(255,255,255,0.5)"
            multiline
            scrollEnabled
            testID="capture-input"
          />
          <LinkPrimary
            label="keep this →"
            onPress={keep}
            style={[styles.keep, { opacity: canKeep ? 1 : 0.35 }]}
            testID="capture-keep"
          />
        </View>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  // The header and context now live outside this view, so the scroll only
  // has to hold chips + field + keep. Lower than the old 440 so the sheet
  // does not overrun the screen top once the keyboard raises it.
  scroll: {
    flexShrink: 1,
    maxHeight: 330,
  },
  lockedScroll: {
    maxHeight: 112,
  },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  context: {
    marginBottom: 18,
  },
  contextDate: {
    ...TypeScale.body,
    letterSpacing: 0.3,
    color: "rgba(235,228,255,0.85)",
    marginBottom: 6,
  },
  contextPrompt: {
    ...TypeScale.serifSmall,
    color: "rgba(235,228,255,0.58)",
  },
  eyebrow: {
    ...TypeScale.metadata,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
  },
  closeTarget: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    marginRight: -8,
  },
  closeGlyph: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
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
    ...TypeScale.label,
    color: "rgba(255,255,255,0.6)",
  },
  chipGlyphActive: {
    color: "rgba(255,255,255,0.9)",
  },
  chipLabel: {
    ...TypeScale.metadata,
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.7)",
  },
  chipLabelActive: {
    color: "rgba(255,255,255,0.95)",
  },

  input: {
    height: 112,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    textAlignVertical: "top",
  },

  inputDock: {
    flexShrink: 0,
  },

  keep: {
    alignSelf: "flex-end",
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 44,
    justifyContent: "center",
  },
});
