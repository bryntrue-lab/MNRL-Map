// Slice J — the note, whole (view · edit · release).
//
// Presented in the teaching-sheet model (SheetShell, modal, swipe to
// dismiss). Reading state: the user's words, whole and scrollable — no
// decoration, no eyebrow. Edit swaps the text block for a multiline input
// (origin-edit precedent: `not now` · `save →`). Release sits at the
// bottom, quiet, with an inline confirm (Settings release-this-field
// treatment — never a red button, never Alert.alert).
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { LinkPrimary, LinkSecondary, LinkWhisper } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import {
  deleteFieldNote,
  fetchEncounterTitle,
  resolveAudioUrl,
  updateFieldNoteContent,
  type FieldNoteWithId,
} from "@/lib/firestore";
import type { PhaseId } from "@/types/firestore";

const PHASE_DISPLAY: Record<PhaseId, string> = {
  signal: "the signal",
  field: "the field",
  friction: "the friction",
  voice: "the voice",
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function noteBodyText(note: FieldNoteWithId): string {
  if (note.content) return note.content;
  if (note.captureMode === "audio") {
    return note.transcriptStatus === "pending"
      ? "spoken — words arriving…"
      : "spoken.";
  }
  return "kept.";
}

interface NoteDetailSheetProps {
  note: FieldNoteWithId | null;
  uid: string | null;
  onClose: () => void;
  bottomPad: number;
}

export function NoteDetailSheet({ note, uid, onClose, bottomPad }: NoteDetailSheetProps) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseFailed, setReleaseFailed] = useState(false);

  // Voice notes — resolve the storage path to a URL once per note.
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const player = useAudioPlayer(audioUrl ? { uri: audioUrl } : null);
  const status = useAudioPlayerStatus(player);

  // Encounter attribution — `{month day} · {lens} · {encounter title}`.
  const [encounterTitle, setEncounterTitle] = useState<string | null>(null);

  const noteId = note?.id ?? null;
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!noteId || noteId === openIdRef.current) return;
    openIdRef.current = noteId;
    // Fresh note — reset every transient state.
    setMode("read");
    setSaveFailed(false);
    setConfirming(false);
    setReleaseFailed(false);
    setAudioUrl(null);
    setEncounterTitle(null);
    if (note?.audioPath) {
      const forId = noteId;
      resolveAudioUrl(note.audioPath)
        .then((url) => {
          // Stale-result guard: the sheet may have closed or moved to
          // another note while the URL resolved — never seed a hidden player.
          if (openIdRef.current === forId) setAudioUrl(url);
        })
        .catch((err) => console.warn("note audio url", err));
    }
    if (note?.encounterRef) {
      const forId = noteId;
      fetchEncounterTitle(note.encounterRef)
        .then((title) => {
          if (openIdRef.current === forId) setEncounterTitle(title);
        })
        .catch((err) => console.warn("note encounter title", err));
    }
  }, [noteId, note]);
  useEffect(() => {
    if (note) return;
    // Sheet closed — stop playback deterministically and drop the source.
    // (SheetShell keeps children mounted through its exit animation, and
    // this component stays mounted under the Notes screen.)
    openIdRef.current = null;
    try {
      player.pause();
    } catch {}
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const metaLine = useMemo(() => {
    if (!note) return "";
    const created = note.createdAt?.toDate?.();
    const when = created
      ? `${MONTHS[created.getMonth()]} ${created.getDate()}`
      : "";
    const parts = [when, PHASE_DISPLAY[note.atmosphere] ?? note.atmosphere];
    if (encounterTitle) parts.push(encounterTitle.toLowerCase());
    return parts.filter(Boolean).join(" · ");
  }, [note, encounterTitle]);

  const startEdit = () => {
    setDraft(note?.content ?? "");
    setSaveFailed(false);
    setMode("edit");
  };

  const save = async () => {
    if (!note || !uid || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await updateFieldNoteContent(uid, note.id, draft);
      setMode("read");
    } catch (err) {
      console.warn("note edit save", err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const release = async () => {
    if (!note || !uid || releasing) return;
    setReleasing(true);
    setReleaseFailed(false);
    try {
      // Audio object first, then doc — the helper's designed contract.
      // On the audio-delete failure path it throws and the note is intact.
      await deleteFieldNote(uid, note.id, note.audioPath);
      onClose();
    } catch (err) {
      console.warn("note release", err);
      setReleaseFailed(true);
    } finally {
      setReleasing(false);
    }
  };

  const maxBody = Dimensions.get("window").height * 0.62;

  return (
    <SheetShell
      open={note != null}
      onClose={onClose}
      bottomPad={bottomPad}
      testID="note-detail"
      swipeToDismiss
      modal
    >
      {note && (
        <>
          {mode === "read" ? (
            <>
              <ScrollView
                style={{ maxHeight: maxBody }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.body} testID="note-detail-text">
                  {noteBodyText(note)}
                </Text>
              </ScrollView>

              {note.audioPath != null && (
                <Pressable
                  onPress={() => {
                    if (!audioUrl) return;
                    if (status.playing) player.pause();
                    else player.play();
                  }}
                  style={styles.playRow}
                  hitSlop={8}
                  disabled={!audioUrl}
                  testID="note-detail-play"
                >
                  <Text
                    style={[styles.playText, !audioUrl && styles.playPending]}
                  >
                    {audioUrl ? (status.playing ? "pause" : "play") : "…"}
                  </Text>
                </Pressable>
              )}

              <Text style={styles.meta} testID="note-detail-meta">
                {metaLine}
              </Text>

              <View style={styles.editRow}>
                <LinkWhisper
                  label="edit →"
                  onPress={startEdit}
                  testID="note-detail-edit"
                />
              </View>
              {saveFailed && (
                <Text style={styles.failed}>not kept — try again</Text>
              )}

              <View style={styles.releaseBlock}>
                {!confirming ? (
                  <LinkSecondary
                    label="release this note"
                    onPress={() => setConfirming(true)}
                    testID="note-detail-release"
                  />
                ) : (
                  <View testID="note-detail-confirm">
                    <Text style={styles.confirmTitle}>release this note?</Text>
                    <Text style={styles.confirmBody}>
                      It leaves the field, and the patterns it fed let it go.
                      There's no way back.
                    </Text>
                    <View style={styles.confirmRow}>
                      <LinkSecondary
                        label="release"
                        onPress={release}
                        testID="note-detail-confirm-release"
                      />
                      <LinkSecondary
                        label="keep it"
                        onPress={() => {
                          setConfirming(false);
                          setReleaseFailed(false);
                        }}
                        testID="note-detail-confirm-keep"
                      />
                    </View>
                  </View>
                )}
                {releaseFailed && (
                  <Text style={styles.failed}>not released — try again</Text>
                )}
              </View>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                multiline
                autoFocus
                placeholder=""
                placeholderTextColor={colors.light.textMuted}
                testID="note-detail-input"
              />
              {saveFailed && (
                <Text style={styles.failed}>not kept — try again</Text>
              )}
              <View style={styles.editFooter}>
                <LinkSecondary
                  label="not now"
                  onPress={() => {
                    setMode("read");
                    setSaveFailed(false);
                  }}
                  testID="note-detail-edit-cancel"
                />
                <View style={{ opacity: saving ? 0.35 : 1 }}>
                  <LinkPrimary
                    label="save →"
                    onPress={save}
                    testID="note-detail-edit-save"
                  />
                </View>
              </View>
            </>
          )}
        </>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    ...TypeScale.bodyLarge,
    color: colors.light.textPrimary,
    lineHeight: 26,
  },
  playRow: {
    marginTop: 18,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  playText: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: colors.light.textSecondary,
  },
  playPending: {
    color: colors.light.textMuted,
  },
  meta: {
    ...TypeScale.metadata,
    letterSpacing: 1.2,
    color: colors.light.textMuted,
    marginTop: 14,
  },
  editRow: {
    marginTop: 22,
    alignSelf: "flex-start",
  },
  releaseBlock: {
    marginTop: 34,
  },
  confirmTitle: {
    ...TypeScale.serifSmall,
    color: colors.light.textPrimary,
    marginBottom: 10,
  },
  confirmBody: {
    ...TypeScale.body,
    color: colors.light.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  failed: {
    ...TypeScale.metadata,
    letterSpacing: 1,
    color: "#E08AAF",
    marginTop: 12,
  },
  input: {
    minHeight: 96,
    maxHeight: 180,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    textAlignVertical: "top",
  },
  editFooter: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
