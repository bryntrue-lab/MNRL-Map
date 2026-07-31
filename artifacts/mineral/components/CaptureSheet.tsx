import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { SheetShell } from "@/components/OriginSheets";
import { FontFamily } from "@/constants/typography";
import {
  createFieldNote,
  newFieldNoteId,
  uploadCaptureAudio,
} from "@/lib/firestore";
import { PHASE_ACCENT } from "@/lib/spiral";
import type { FieldNoteType, NoteSource, PhaseId } from "@/types/firestore";

// ─────────────────────────────────────────────────────────────
// The capture sheet — nine chips, one soft field. Shared verbatim
// between the Notes tab (spontaneous) and the encounter's ambient
// `+` (source 'encounter' + encounterRef, questionId stays null).
//
// C.1 §0.4 — every capture point offers BOTH voice and text, and the
// mode toggle works in BOTH directions before keeping, preserving any
// typed draft. Voice mirrors the proven ⟡ pattern (encounter.tsx):
// record → newFieldNoteId → uploadCaptureAudio → createFieldNote
// (audio, transcriptStatus pending; upload failure → audioPath null +
// transcriptStatus 'failed'). No mic / web fallback → quiet type mode.
// ─────────────────────────────────────────────────────────────

const BAR_COUNT = 26;

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
  /** v1.8 — set when the map itself provoked this capture (counterweight). */
  mapRef?: { date: string; phase: PhaseId } | null;
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
  mapRef,
  onSaved,
}: CaptureSheetProps) {
  const [type, setType] = useState<FieldNoteType | null>(initialType ?? null);
  const [text, setText] = useState("");
  const [typeMode, setTypeMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.06));
  const busy = useRef(false);
  const permRef = useRef(false);
  const lastDurationRef = useRef(0);

  const accent = PHASE_ACCENT[atmosphere];

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recState = useAudioRecorderState(recorder, 80);

  // Each opening starts fresh at the caller's preselection.
  useEffect(() => {
    if (open) {
      setType(initialType ?? null);
      setText("");
      setTypeMode(false);
      setRecording(false);
      setBars(Array(BAR_COUNT).fill(0.06));
      busy.current = false;
    }
  }, [open, initialType]);

  // Live waveform while recording — mirrors the ⟡ metering read.
  useEffect(() => {
    if (!recState.isRecording) return;
    lastDurationRef.current = recState.durationMillis;
    const m = recState.metering;
    const v =
      m == null
        ? 0.25 + 0.2 * Math.abs(Math.sin(recState.durationMillis / 160))
        : Math.min(1, Math.max(0.06, (m + 60) / 60));
    setBars((prev) => [...prev.slice(1), v]);
  }, [recState.durationMillis, recState.isRecording, recState.metering]);

  // ── Voice path (mirrors encounter.tsx §1c) ──
  const beginRecord = async () => {
    if (typeMode || busy.current || recording || type == null) return;
    try {
      if (!permRef.current) {
        const res = await requestRecordingPermissionsAsync();
        permRef.current = res.granted;
        if (!res.granted) {
          // Denied — the quiet path is typing; no error surfaces.
          setTypeMode(true);
          return;
        }
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (err) {
      console.warn("recording unavailable", err);
      setTypeMode(true);
    }
  };

  const endRecord = async () => {
    if (!recording) return;
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      // A grazed button is a breath, not a word — discard quietly.
      if (!uri || lastDurationRef.current < 700) return;
      keepVoice(uri);
    } catch (err) {
      console.warn("recording not kept", err);
    }
  };

  const keepVoice = (uri: string) => {
    if (busy.current || !uid || !type) return;
    busy.current = true;
    const noteId = newFieldNoteId(uid);
    const contentType = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
    // Fire-and-forget: upload first, then the doc (§1c order). Offline, the
    // upload fails after its retry window and the note lands terminally
    // 'failed' — never stuck 'pending' with no audio behind it.
    (async () => {
      let audioPath: string | null = null;
      try {
        audioPath = await uploadCaptureAudio(uid, noteId, uri, contentType);
      } catch (err) {
        console.warn("capture upload failed", err);
      }
      createFieldNote(
        uid,
        {
          type,
          captureMode: "audio",
          audioPath,
          source,
          encounterRef: encounterRef ?? undefined,
          atmosphere,
          mapRef: mapRef ?? null,
          ...(audioPath ? {} : { transcriptStatus: "failed" as const }),
        },
        noteId
      ).catch((err) => console.warn("capture write queued/failed", err));
    })();
    onSaved?.();
    onClose();
  };

  // ── Text path ──
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

  // ── Swipe-down-to-dismiss (drag the sheet body down to close) ──
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dx) < 40,
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 70) onClose();
      },
    })
  ).current;

  return (
    <SheetShell open={open} onClose={onClose} bottomPad={bottomPad} testID="capture-sheet">
      <View style={styles.grabHandle} {...pan.panHandlers}>
        <View style={styles.grabBar} />
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={styles.close}
        testID="capture-close"
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
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

        {type != null &&
          (!typeMode ? (
            <View style={styles.recordWrap}>
              <View style={styles.waveRow} testID="capture-waveform">
                {recording &&
                  bars.map((v, i) => (
                    <View
                      key={i}
                      style={[styles.waveBar, { height: 4 + v * 34, backgroundColor: accent }]}
                    />
                  ))}
              </View>
              <Pressable
                onPressIn={beginRecord}
                onPressOut={endRecord}
                style={[
                  styles.recordButton,
                  { borderColor: recording ? accent : "rgba(255,255,255,0.22)" },
                ]}
                testID="capture-record"
              >
                <View
                  style={[
                    styles.recordCore,
                    { backgroundColor: recording ? accent : "rgba(255,255,255,0.14)" },
                  ]}
                />
              </Pressable>
              <Text style={styles.recordHint}>
                {recording ? "listening" : "hold to speak"}
              </Text>
              <Pressable
                onPress={() => setTypeMode(true)}
                hitSlop={10}
                style={styles.modeToggle}
                testID="capture-type-instead"
              >
                <Text style={styles.modeToggleText}>type instead</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.typeWrap}>
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
              <View style={styles.typeFooter}>
                <Pressable
                  onPress={() => setTypeMode(false)}
                  hitSlop={10}
                  style={styles.modeToggle}
                  testID="capture-speak-instead"
                >
                  <Text style={styles.modeToggleText}>speak instead</Text>
                </Pressable>
                <Pressable
                  onPress={keep}
                  style={[styles.keep, { opacity: canKeep ? 1 : 0.35 }]}
                  testID="capture-keep"
                >
                  <Text style={styles.keepText}>keep this →</Text>
                </Pressable>
              </View>
            </View>
          ))}
      </KeyboardAwareScrollViewCompat>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  grabHandle: {
    alignItems: "center",
    paddingBottom: 12,
    marginTop: -8,
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  close: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
  },

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

  // Voice
  recordWrap: {
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 42,
    marginBottom: 22,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    opacity: 0.85,
  },
  recordButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recordCore: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  recordHint: {
    marginTop: 16,
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
  },
  modeToggle: {
    marginTop: 22,
    minHeight: 44,
    justifyContent: "center",
  },
  modeToggleText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },

  // Text
  typeWrap: {
    width: "100%",
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
  typeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
