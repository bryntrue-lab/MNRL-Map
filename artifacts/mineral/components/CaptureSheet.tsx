import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LinkPrimary, LinkSecondary } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import { TypeScale } from "@/constants/typography";
import { createFieldNote, newFieldNoteId, uploadCaptureAudio } from "@/lib/firestore";
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

type RecordingAttempt = {
  cancelled: boolean;
  released: boolean;
  prepared: boolean;
  audioMode: boolean;
  ready: boolean;
  cleanup?: Promise<boolean>;
};

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
  const [typeMode, setTypeMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [microphoneBlocked, setMicrophoneBlocked] = useState(false);
  const busy = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const attemptRef = useRef<RecordingAttempt | null>(null);
  const sessionRef = useRef(0);
  const openRef = useRef(open);
  // Retain the id/audio after a failed write, so retry never creates a second
  // note or uploads the same successful recording again.
  const voiceRef = useRef<{ uri: string; noteId: string; audioPath?: string } | null>(null);

  const cleanRecording = (attempt: RecordingAttempt) => {
    if (attempt.cleanup) return attempt.cleanup;
    attempt.cleanup = (async () => {
      let stopped = true;
      try {
        if (attempt.prepared) await recorder.stop();
      } catch (err) {
        stopped = false;
        console.warn("recording not kept", err);
      } finally {
        if (attempt.audioMode) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            allowsRecording: false,
          }).catch((err) => console.warn("recording cleanup failed", err));
        }
        if (attemptRef.current === attempt) attemptRef.current = null;
      }
      return stopped;
    })();
    return attempt.cleanup;
  };

  // Each opening starts fresh at the caller's preselection.
  useEffect(() => {
    openRef.current = open;
    sessionRef.current++;
    if (open) {
      setType(lockedType ?? initialType ?? null);
      setText("");
      setTypeMode(false);
      setRecording(false);
      setFailed(false);
      setMicrophoneBlocked(false);
      voiceRef.current = null;
      // The dismiss guard normally prevents this race; don't clear it if the
      // caller changes visibility while a persistence promise is still alive.
      if (!saving) busy.current = false;
    }
    return () => {
      openRef.current = false;
      sessionRef.current++;
      const attempt = attemptRef.current;
      if (attempt) {
        attempt.cancelled = true;
        // A permission/preparation promise cleans itself when it settles.
        if (attempt.ready) void cleanRecording(attempt);
      }
    };
  }, [open]);

  // 2.1.2 — focus only after the slide-in settles (420ms). Focusing
  // mid-entrance made the scroll-into-view fight the animation, leaving
  // the field clipped at the sheet's top edge.
  useEffect(() => {
    if (!open || type == null || !typeMode) return;
    const t = setTimeout(() => inputRef.current?.focus(), 460);
    return () => clearTimeout(t);
  }, [open, type, typeMode]);

  const canKeep = type != null && uid != null && !saving &&
    (typeMode ? text.trim().length > 0 : voiceRef.current != null);

  // Do not dismiss/reopen during a pending write: that would reset the busy
  // guard and let a second save or the encounter's map link race the charge.
  const dismiss = () => {
    if (busy.current) return;
    openRef.current = false;
    sessionRef.current++;
    const attempt = attemptRef.current;
    if (attempt) {
      attempt.cancelled = true;
      if (attempt.ready) void cleanRecording(attempt);
    }
    setRecording(false);
    onClose();
  };

  const persist = async (voice: typeof voiceRef.current = null) => {
    if (busy.current || !openRef.current || !uid || !type) return;
    if (!voice && !text.trim()) return;
    busy.current = true;
    setSaving(true);
    setFailed(false);
    const session = sessionRef.current;
    try {
      if (voice && !voice.audioPath) {
        voice.audioPath = await uploadCaptureAudio(
          uid, voice.noteId, voice.uri,
          Platform.OS === "web" ? "audio/webm" : "audio/m4a"
        );
      }
      await createFieldNote(uid, {
        type,
        captureMode: voice ? "audio" : "text",
        ...(voice ? { audioPath: voice.audioPath } : { content: text.trim() }),
        source,
        encounterRef: encounterRef ?? undefined,
        // questionId stays null — only the ⟡ capture carries one.
        atmosphere,
        mapRef: mapRef ?? null,
      }, voice?.noteId);
      if (session === sessionRef.current && openRef.current) {
        onSaved?.();
        onClose();
      }
    } catch (err) {
      console.warn("capture not kept", err);
      busy.current = false;
      if (session === sessionRef.current && openRef.current) setFailed(true);
    } finally {
      if (session !== sessionRef.current) busy.current = false;
      setSaving(false);
    }
  };

  const beginRecord = async () => {
    if (busy.current || attemptRef.current || !openRef.current || typeMode || !type || !uid) return;
    const attempt: RecordingAttempt = {
      cancelled: false, released: false, prepared: false, audioMode: false, ready: false,
    };
    attemptRef.current = attempt;
    voiceRef.current = null;
    setFailed(false);
    Keyboard.dismiss();
    const active = () => !attempt.cancelled && !attempt.released && openRef.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!active()) return;
      if (!permission.granted) {
        // Same approved quiet denial path as the encounter's ⟡ capture.
        setMicrophoneBlocked(!permission.canAskAgain);
        setTypeMode(true);
        return;
      }
      setMicrophoneBlocked(false);
      attempt.audioMode = true;
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsRecording: true,
      });
      if (!active()) return;
      attempt.prepared = true;
      await recorder.prepareToRecordAsync();
      if (!active()) return;
      recorder.record();
      attempt.ready = true;
      setRecording(true);
    } catch (err) {
      console.warn("recording unavailable", err);
      if (active()) setTypeMode(true);
    } finally {
      if (!attempt.ready) await cleanRecording(attempt);
    }
  };

  const endRecord = async () => {
    const attempt = attemptRef.current;
    if (!attempt || attempt.released) return;
    attempt.released = true;
    // Release during permission/prepare must never start a ghost recording.
    if (!attempt.ready || attempt.cancelled || busy.current) return;
    busy.current = true; // stop/audio-mode restoration are part of the save
    setSaving(true);
    setRecording(false);
    const session = sessionRef.current;
    let duration = 0;
    try {
      duration = recorder.currentTime;
      const stopped = await cleanRecording(attempt);
      if (session !== sessionRef.current || !openRef.current) return;
      if (!stopped) {
        setFailed(true);
        return;
      }
      const uri = recorder.uri;
      if (!uri || duration < 0.7) return; // the existing grazed-button guard
      voiceRef.current = { uri, noteId: newFieldNoteId(uid!) };
      busy.current = false;
      await persist(voiceRef.current);
    } catch (err) {
      console.warn("recording not kept", err);
      if (session === sessionRef.current && openRef.current) setFailed(true);
    } finally {
      // Even a released native object's duration/URI getter can throw.
      await cleanRecording(attempt);
      // Successful persistence keeps its synchronous double-save latch.
      if (!voiceRef.current) busy.current = false;
      setSaving(false);
    }
  };

  const switchMode = (typing: boolean) => {
    if (busy.current) return;
    const attempt = attemptRef.current;
    if (attempt) {
      attempt.cancelled = true;
      if (attempt.ready) void cleanRecording(attempt);
    }
    setRecording(false);
    setFailed(false);
    voiceRef.current = null;
    setTypeMode(typing);
    if (!typing) Keyboard.dismiss();
  };

  return (
    <SheetShell
      open={open}
      onClose={dismiss}
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
        <Pressable onPress={dismiss} style={styles.closeTarget} hitSlop={8} testID="capture-close">
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
                onPress={() => {
                  if (!busy.current && !attemptRef.current) setType(chip.id);
                }}
                disabled={saving || recording}
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
          {typeMode ? (
          <>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="when you're ready"
            placeholderTextColor="rgba(255,255,255,0.5)"
            multiline
            editable={!saving}
            scrollEnabled
            testID="capture-input"
          />
          <LinkPrimary
            label="keep this →"
            onPress={() => persist()}
            disabled={!canKeep}
            style={[styles.keep, { opacity: canKeep ? 1 : 0.35 }]}
            testID="capture-keep"
          />
          <LinkSecondary
            label="speak instead"
            onPress={() => switchMode(false)}
            disabled={saving}
            style={styles.modeLink}
            testID="capture-speak-instead"
          />
          </>
          ) : (
          <View style={styles.recordWrap}>
            <Pressable
              onPressIn={beginRecord}
              onPressOut={endRecord}
              disabled={saving}
              style={[styles.recordButton, recording && styles.recordButtonActive]}
              testID="capture-record"
            >
              <View style={[styles.recordCore, recording && styles.recordCoreActive]} />
            </Pressable>
            <Text style={styles.recordHint}>{recording ? "listening" : "hold to speak"}</Text>
            {voiceRef.current && failed ? (
              <LinkPrimary
                label="keep this →"
                onPress={() => persist(voiceRef.current)}
                disabled={!canKeep}
                testID="capture-keep"
              />
            ) : null}
            <LinkSecondary
              label="type instead"
              onPress={() => switchMode(true)}
              disabled={saving}
              style={styles.modeLink}
              testID="capture-type-instead"
            />
          </View>
          )}
          {failed ? <Text style={styles.failed} testID="capture-failed">not kept — try again</Text> : null}
          {microphoneBlocked && Platform.OS !== "web" ? (
            <Pressable
              accessibilityLabel="Open settings"
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch (err) {
                  console.warn("microphone settings unavailable", err);
                }
              }}
              style={styles.settingsTarget}
              testID="capture-microphone-settings"
            >
              {/* Reuse Today's approved settings glyph and accessibility copy. */}
              <Text style={styles.settingsGlyph}>···</Text>
            </Pressable>
          ) : null}
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
  recordWrap: {
    alignItems: "center",
    paddingTop: 8,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    borderColor: "rgba(235,228,255,0.85)",
  },
  recordCore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  recordCoreActive: {
    backgroundColor: "rgba(235,228,255,0.85)",
  },
  recordHint: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    marginTop: 10,
  },
  modeLink: {
    alignSelf: "center",
    marginTop: 14,
  },
  failed: {
    ...TypeScale.metadata,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 8,
  },
  settingsTarget: {
    alignSelf: "center",
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsGlyph: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 3,
  },

  keep: {
    alignSelf: "flex-end",
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 44,
    justifyContent: "center",
  },
});
