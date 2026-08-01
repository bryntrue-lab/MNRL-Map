import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router } from "expo-router";
import { EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import {
  ArchaicAtmosphere,
  MagicalAtmosphere,
  MentalAtmosphere,
  MythicalAtmosphere,
} from "@/components/Atmosphere";
import { CaptureSheet } from "@/components/CaptureSheet";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MorningCallMoment } from "@/components/MorningCall";
import { QuietToast } from "@/components/OriginSheets";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  HELD_SILENCE_MS,
  HOLD_TIMEOUT_MS,
  consumeEncounterSession,
  crystallizingPrompt,
  postCaptureBlocks,
  warmUpPrompts,
  wovenLine,
  type EncounterSession,
} from "@/lib/encounter";
import {
  completeEncounter,
  createFieldNote,
  fieldNoteRef,
  newFieldNoteId,
  saveAudioPosition,
  saveBlockIndex,
  uploadCaptureAudio,
  userEncounterId,
} from "@/lib/firestore";
import {
  hasPromptBeenShown as morningCallPromptShown,
  markPromptShown as markMorningCallPromptShown,
  rescheduleMorningCall,
  saveChoice as saveMorningCallChoice,
  type MorningCallChoice,
} from "@/lib/morningCall";
import {
  COUNTERWEIGHT_QUESTION,
  CX,
  CY,
  MAX_AGE,
  PHASE_ACCENT,
  ageAt,
  counterweightDate,
  pt,
  resolve,
  ritualDateLabel,
  spiralPath,
} from "@/lib/spiral";
import type { EncounterBlock, FieldNoteDoc, PhaseId } from "@/types/firestore";

const ATMOSPHERE: Record<PhaseId, React.ComponentType> = {
  signal: ArchaicAtmosphere,
  field: MagicalAtmosphere,
  friction: MythicalAtmosphere,
  voice: MentalAtmosphere,
};

const GLYPH_BLUE = "#9bb2e8";
const BAR_COUNT = 26;

/** A local date as an ISO YYYY-MM-DD string (mapRef, v1.8). */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type Stage = "listen" | "capture" | "hold" | "counterweight" | "block" | "close";

/**
 * The encounter (§1) — a held space. No tab bar, no progress indicators,
 * one screen per state: Listen → ⟡ Capture → [Hold] → Counterweight →
 * post-capture blocks → Close. Arriving without a session (deep link,
 * reload) returns quietly to the tabs.
 */
export default function EncounterScreen() {
  const { user } = useAuth();
  // Consume exactly once, before first render commits.
  const sessionRef = useRef<EncounterSession | null | undefined>(undefined);
  if (sessionRef.current === undefined) {
    sessionRef.current = consumeEncounterSession();
  }
  const session = sessionRef.current;

  useEffect(() => {
    if (!session || !user) router.replace("/(tabs)");
  }, [session, user]);

  if (!session || !user) {
    return <View style={styles.container} />;
  }
  return <EncounterFlow session={session} user={user} />;
}

function EncounterFlow({ session, user }: { session: EncounterSession; user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const uid = user.uid;
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useUser();

  const { encounter, turn, mode, audioUrl } = session;
  const phase = encounter.phase;
  const Atmosphere = ATMOSPHERE[phase];
  const accent = PHASE_ACCENT[phase];
  const instanceId = userEncounterId(encounter.id, turn);
  const sequence = mode === "sequence";

  const prompt = useMemo(() => {
    const c = crystallizingPrompt(encounter.blocks);
    if (c) return c;
    // Degenerate data — fall back to the first reflection prompt.
    for (const b of encounter.blocks ?? []) {
      if (b.type === "reflection" && b.prompts.length > 0) return b.prompts[0];
    }
    return null;
  }, [encounter.blocks]);
  const postBlocks = useMemo(
    () => postCaptureBlocks(encounter.blocks),
    [encounter.blocks]
  );
  const warmUp = useMemo(
    () => warmUpPrompts(encounter.blocks),
    [encounter.blocks]
  );

  // Counterweight availability — birth date present and old enough that
  // (age − 14) exists on the map (§1e; no birth date → skip the screen).
  const birthDate = profile?.birthDate ?? null;
  const currentAge = useMemo(
    () => (birthDate ? ageAt(birthDate.toDate(), new Date()) : null),
    [birthDate]
  );
  const cwAvailable = currentAge != null && currentAge - 14 >= 0;

  // ── Stage state, seeded from the resume rules (§4) ──
  const initial = useMemo<{ stage: Stage; blockIdx: number; woven: string | null }>(() => {
    const r = session.resume;
    const promptText = prompt?.text ?? "";
    if (r && r.blockIndex >= 1) {
      if (postBlocks.length === 0) return { stage: "close", blockIdx: 1, woven: null };
      return {
        stage: "block",
        blockIdx: Math.min(r.blockIndex, postBlocks.length),
        woven: null,
      };
    }
    if (r?.crystallizing) {
      if (cwAvailable) {
        return {
          stage: "counterweight",
          blockIdx: 0,
          woven: wovenLine(r.crystallizing.content, promptText),
        };
      }
      return postBlocks.length > 0
        ? { stage: "block", blockIdx: 1, woven: null }
        : { stage: "close", blockIdx: 1, woven: null };
    }
    return { stage: "listen", blockIdx: 0, woven: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stage, setStage] = useState<Stage>(initial.stage);
  const [blockIdx, setBlockIdx] = useState(initial.blockIdx);
  const [woven, setWoven] = useState<string | null>(initial.woven);
  const [cwShown, setCwShown] = useState(initial.stage === "counterweight");
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const [sheetOpen, setSheetOpen] = useState(false);
  // Which affordance opened the shared sheet: the ambient + (spontaneous
  // reflection) or the counterweight's "keep what comes →" (carries mapRef).
  const [sheetKind, setSheetKind] = useState<"ambient" | "counterweight">("ambient");
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  // The account moment (Task C §2) — this encounter produced a crystallizing
  // capture. Shown once ever on the close screen; the once-ever flag lives on
  // the user doc (additive boolean, cache-safe).
  const [producedCrystallizing, setProducedCrystallizing] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountDismissed, setAccountDismissed] = useState(false);
  const accountBusyRef = useRef(false);
  const accountFlaggedRef = useRef(false);

  // The morning call moment — shown once ever, on the first encounter close
  // where the account moment is NOT taking the space (account takes the first
  // close, the morning call the next). Local flag only (AsyncStorage).
  const [morningCallEligible, setMorningCallEligible] = useState(false);
  const [morningCallDismissed, setMorningCallDismissed] = useState(false);
  const morningCallFlaggedRef = useRef(false);

  // ── Listen (§1b) ──
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);
  const startedRef = useRef(false);
  const heldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Narration continues while the phone locks (UIBackgroundModes is
    // configured in app.json). staysActiveInBackground is unsupported on web.
    setAudioModeAsync({
      playsInSilentMode: true,
      ...(Platform.OS === "web" ? {} : { staysActiveInBackground: true }),
    }).catch(() => {});
  }, []);

  // Start once the source is loaded — seek first when resuming (§4).
  useEffect(() => {
    if (stage !== "listen" || startedRef.current || !(status.duration > 0)) return;
    startedRef.current = true;
    const pos = session.resume?.audioPosition ?? 0;
    (async () => {
      try {
        if (pos > 0 && pos < status.duration - 2) await player.seekTo(pos);
      } catch {
        // Seek is best-effort; playing from the top is the graceful floor.
      }
      player.play();
    })();
  }, [stage, status.duration, player, session.resume]);

  const persistPosition = () => {
    if (!sequence) return;
    const secs = player.currentTime;
    if (Number.isFinite(secs) && secs > 0) {
      saveAudioPosition(uid, encounter.id, turn, secs).catch(() => {});
    }
  };

  // Background → pause and persist; return resumes from position, paused.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" && stageRef.current === "listen") {
        try {
          player.pause();
        } catch {}
        persistPosition();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the screen mid-audio also persists (§4).
  useEffect(
    () => () => {
      if (stageRef.current === "listen") persistPosition();
      if (heldTimer.current != null) clearTimeout(heldTimer.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Audio completes → 1.5s held silence → the ⟡ screen.
  useEffect(() => {
    if (stage !== "listen" || !status.didJustFinish) return;
    heldTimer.current = setTimeout(() => toCapture(), HELD_SILENCE_MS);
    return () => {
      if (heldTimer.current != null) clearTimeout(heldTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish, stage]);

  // Breathing dot — proof of playback, running only while playing.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "listen" || !status.playing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, status.playing, breath]);

  const toCapture = () => {
    try {
      player.pause();
    } catch {}
    if (mode === "sequence") {
      // Reaching the ⟡ means the audio moment is spent; position resets.
      saveAudioPosition(uid, encounter.id, turn, 0).catch(() => {});
    }
    setStage("capture");
  };

  // ── ⟡ Capture (§1c) ──
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recState = useAudioRecorderState(recorder, 80);
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  // Warm-up reveal (C.1 §5) — collapsed by default, always.
  const [warmUpOpen, setWarmUpOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.06));
  const permRef = useRef(false);
  const savingRef = useRef(false);
  const lastDurationRef = useRef(0);
  const [holdNoteId, setHoldNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "capture" || !recState.isRecording) return;
    lastDurationRef.current = recState.durationMillis;
    const m = recState.metering;
    const v =
      m == null
        ? 0.25 + 0.2 * Math.abs(Math.sin(recState.durationMillis / 160))
        : Math.min(1, Math.max(0.06, (m + 60) / 60));
    setBars((prev) => [...prev.slice(1), v]);
  }, [recState.durationMillis, recState.isRecording, recState.metering, stage]);

  const beginRecord = async () => {
    if (typeMode || savingRef.current || recording) return;
    try {
      if (!permRef.current) {
        const res = await requestRecordingPermissionsAsync();
        permRef.current = res.granted;
        if (!res.granted) {
          // Denied — the quiet path is typing; no error surfaces (§1c).
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
    if (savingRef.current || !prompt) return;
    savingRef.current = true;
    setProducedCrystallizing(true);
    const noteId = newFieldNoteId(uid);
    const contentType = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
    const questionId = prompt.id;
    // The hold begins NOW — connectivity may never delay the ritual (§4).
    // The 60s fallback and the note's onSnapshot cover every outcome below.
    setHoldNoteId(noteId);
    setStage("hold");
    // Background: upload first, then the doc (§1c order), never awaited by
    // the UI. Offline, the upload fails after its retry window and the note
    // lands terminally 'failed' — never stuck 'pending' with no audio.
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
          type: "reflection",
          captureMode: "audio",
          audioPath,
          source: "encounter",
          encounterRef: instanceId,
          questionId,
          atmosphere: phase,
          ...(audioPath ? {} : { transcriptStatus: "failed" as const }),
        },
        noteId
      ).catch((err) => console.warn("capture write queued/failed", err));
    })();
  };

  const keepTyped = () => {
    const content = typed.trim();
    if (!content || savingRef.current || !prompt) return;
    savingRef.current = true;
    setProducedCrystallizing(true);
    createFieldNote(uid, {
      type: "reflection",
      captureMode: "text",
      content,
      source: "encounter",
      encounterRef: instanceId,
      questionId: prompt.id,
      atmosphere: phase,
    }).catch((err) => console.warn("capture write queued/failed", err));
    toResolution(content);
  };

  // ── The beautiful hold (§1d) ──
  useEffect(() => {
    if (stage !== "hold" || !holdNoteId) return;
    let settled = false;
    const settle = (content: string | null) => {
      if (settled) return;
      settled = true;
      toResolution(content);
    };
    const timer = setTimeout(() => settle(null), HOLD_TIMEOUT_MS);
    const unsub = onSnapshot(
      fieldNoteRef(uid, holdNoteId),
      (snap) => {
        const d = snap.data() as FieldNoteDoc | undefined;
        if (!d) return;
        if (d.transcriptStatus === "done") settle(d.content ?? null);
        else if (d.transcriptStatus === "failed") settle(null);
      },
      () => settle(null)
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, holdNoteId]);

  // Slow breath over the whole atmosphere during the hold (4s cycle).
  const holdBreath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "hold") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(holdBreath, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(holdBreath, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, holdBreath]);

  // ── Advancing ──
  const toResolution = (content: string | null) => {
    if (cwAvailable && prompt) {
      setWoven(wovenLine(content, prompt.text));
      setCwShown(true);
      setStage("counterweight");
      return;
    }
    if (postBlocks.length > 0) toBlock(1);
    else toClose();
  };

  const toBlock = (i: number) => {
    setBlockIdx(i);
    setStage("block");
    if (sequence) saveBlockIndex(uid, encounter.id, turn, i).catch(() => {});
  };

  const toClose = () => {
    setStage("close");
  };

  const advanceBlock = () => {
    if (blockIdx < postBlocks.length) toBlock(blockIdx + 1);
    else toClose();
  };

  // Quiet back — ‹ or swipe-right, for re-reading only (§1).
  const goBack = () => {
    if (stage === "close") {
      if (postBlocks.length > 0) toBlock(postBlocks.length);
      else if (cwShown) setStage("counterweight");
      return;
    }
    if (stage === "block") {
      if (blockIdx > 1) toBlock(blockIdx - 1);
      else if (cwShown) setStage("counterweight");
    }
  };
  const canGoBack =
    (stage === "block" && (blockIdx > 1 || cwShown)) ||
    (stage === "close" && (postBlocks.length > 0 || cwShown));

  const backRef = useRef(goBack);
  backRef.current = goBack;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 24 && Math.abs(g.dy) < 30,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 60) backRef.current();
      },
    })
  ).current;

  // ── Close (§1g) ──
  const closingRef = useRef(false);
  const closeOut = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (sequence) {
      // Not awaited — offline, the batch commits when connectivity returns;
      // the local snapshot already advances the CTA (§4).
      completeEncounter(uid, encounter.id, turn, profile?.sequenceDay ?? 1).catch(
        (err) => console.warn("completion queued/failed", err)
      );
    }
    router.replace("/(tabs)/origin");
  };

  // ── The account moment (Task C §2) ──
  // Show only when: the user is still anonymous, this encounter produced a
  // crystallizing capture, and the once-ever flag isn't already set.
  const accountMomentAlreadyShown =
    (profile as { accountMomentShown?: boolean } | null)?.accountMomentShown === true;
  // Eligibility, independent of the in-session dismissal — this is what
  // arbitrates the whole close (account moment wins the entire first close).
  const accountMomentEligible =
    user.isAnonymous && producedCrystallizing && !accountMomentAlreadyShown;
  const showAccountMoment =
    stage === "close" && accountMomentEligible && !accountDismissed;

  // Freeze the account-vs-morning-call decision at the moment the close stage
  // mounts. If the account moment was eligible when the close appeared, the
  // morning call is suppressed for this entire close — dismissing the account
  // moment does NOT let the morning call slip in on the same close (§1). The
  // morning call waits for a later close.
  const accountClaimedCloseRef = useRef<boolean | null>(null);
  if (stage === "close" && accountClaimedCloseRef.current === null) {
    accountClaimedCloseRef.current = accountMomentEligible;
  }

  // Set the flag the moment the screen is shown, regardless of outcome.
  useEffect(() => {
    if (!showAccountMoment || accountFlaggedRef.current) return;
    accountFlaggedRef.current = true;
    updateProfile({ accountMomentShown: true } as unknown as Parameters<
      typeof updateProfile
    >[0]).catch((err) => console.warn("account moment flag not written", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAccountMoment]);

  // Read the local once-ever flag on mount — the morning call moment has
  // never been shown yet.
  useEffect(() => {
    morningCallPromptShown().then((shown) => {
      if (!shown) setMorningCallEligible(true);
    });
  }, []);

  // The morning call moment shows on the close screen only when the account
  // moment did NOT claim this close (frozen at close entry) — account takes
  // the first close, the morning call waits for a later one. Once ever.
  const showMorningCallMoment =
    stage === "close" &&
    morningCallEligible &&
    accountClaimedCloseRef.current === false &&
    !morningCallDismissed;

  // Mark the local flag the moment the screen is shown, regardless of outcome.
  useEffect(() => {
    if (!showMorningCallMoment || morningCallFlaggedRef.current) return;
    morningCallFlaggedRef.current = true;
    markMorningCallPromptShown().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMorningCallMoment]);

  const allowMorningCall = (choice: MorningCallChoice) => {
    setMorningCallDismissed(true);
    (async () => {
      await saveMorningCallChoice(choice);
      await rescheduleMorningCall({
        sequenceDay: profile?.sequenceDay ?? 1,
        currentTurn: profile?.currentTurn ?? 1,
      });
    })().catch(() => {});
  };

  const linkAccount = async () => {
    const email = accountEmail.trim();
    if (!email || !accountPassword || accountBusyRef.current) return;
    accountBusyRef.current = true;
    setAccountError(null);
    try {
      const credential = EmailAuthProvider.credential(email, accountPassword);
      await linkWithCredential(user, credential);
      // uid and all data preserved — record the email on the user doc.
      updateProfile({ email }).catch((err) =>
        console.warn("account email not written", err)
      );
      setAccountDismissed(true);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code === "auth/email-already-in-use" ||
        code === "auth/credential-already-in-use"
      ) {
        setAccountError(
          "that address already keeps a field. try another, or come back later."
        );
      } else {
        setAccountError("that didn't hold. try again.");
      }
      accountBusyRef.current = false;
    }
  };

  // ── Counterweight geometry (§1e) — Task A spiral math at small scale ──
  const cw = useMemo(() => {
    if (!cwAvailable || currentAge == null || !birthDate) return null;
    const cwAge = currentAge - 14;
    const r = resolve(cwAge);
    const date = counterweightDate(birthDate.toDate(), new Date(), currentAge, currentAge);
    const pNow = pt(currentAge);
    const pCw = pt(cwAge);
    const pad = 34;
    const xs = [pNow.x, pCw.x, CX];
    const ys = [pNow.y, pCw.y, CY];
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) + pad - minX;
    const h = Math.max(...ys) + pad - minY;
    return {
      question: COUNTERWEIGHT_QUESTION[r.phase],
      color: r.station.color,
      // The position being read — for the counterweight capture's mapRef (§6).
      phase: r.phase,
      dateISO: localISO(date),
      dateLabel: ritualDateLabel(date),
      arc: spiralPath(Math.max(0, cwAge - 3), Math.min(MAX_AGE, currentAge + 3)),
      pNow,
      pCw,
      vb: `${minX} ${minY} ${w} ${h}`,
      ratio: h / w,
    };
  }, [cwAvailable, currentAge, birthDate]);

  // ── Render ──
  const block: EncounterBlock | null =
    stage === "block" && blockIdx >= 1 ? (postBlocks[blockIdx - 1] ?? null) : null;
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);

  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const breathOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] });
  const holdOpacity = holdBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, stage === "hold" && { opacity: holdOpacity }]}>
        <Atmosphere />
      </Animated.View>
      {stage === "counterweight" && <View style={styles.darken} />}

      {/* Quiet back ‹ */}
      {canGoBack && (
        <Pressable
          onPress={goBack}
          hitSlop={14}
          style={[styles.backChevron, { top: insets.top + 14 }]}
          testID="encounter-back"
        >
          <Text style={styles.backChevronText}>‹</Text>
        </Pressable>
      )}

      {/* Ambient + — block screens only, never the ⟡ (§1f) */}
      {stage === "block" && (
        <Pressable
          onPress={() => {
            setSheetKind("ambient");
            setSheetOpen(true);
          }}
          hitSlop={14}
          style={[styles.ambientPlus, { top: insets.top + 14 }]}
          testID="encounter-ambient-plus"
        >
          <Text style={styles.ambientPlusText}>+</Text>
        </Pressable>
      )}

      {/* ── Listen ── */}
      {stage === "listen" && (
        <View style={styles.fill}>
          <View style={styles.listenCenter}>
            <Animated.View
              style={[
                styles.breathDot,
                {
                  backgroundColor: accent,
                  transform: [{ scale: breathScale }],
                  opacity: status.playing ? breathOpacity : 0.25,
                },
              ]}
              testID="listen-dot"
            />
          </View>
          <View style={[styles.listenControls, { paddingBottom: insets.bottom + 34 }]}>
            <View style={styles.listenSide} />
            <Pressable
              onPress={() => (status.playing ? player.pause() : player.play())}
              style={styles.playPause}
              hitSlop={8}
              testID="listen-toggle"
            >
              <Text style={styles.playPauseText}>{status.playing ? "pause" : "play"}</Text>
            </Pressable>
            <View style={styles.listenSide}>
              <Pressable onPress={toCapture} hitSlop={12} style={styles.skip} testID="listen-skip">
                <Text style={styles.skipText}>skip →</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── ⟡ Capture ── */}
      {stage === "capture" && prompt && (
        <KeyboardAwareScrollViewCompat
          style={styles.fill}
          contentContainerStyle={[
            styles.captureContent,
            { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.glyph}>⟡</Text>
          <Text style={styles.captureEyebrow}>WHAT TO KEEP</Text>
          <Text style={styles.capturePrompt}>{prompt.text}</Text>
          {prompt.subtext ? <Text style={styles.captureSubtext}>{prompt.subtext}</Text> : null}

          {!typeMode ? (
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
                style={styles.typeToggle}
                testID="capture-type-instead"
              >
                <Text style={styles.typeToggleText}>type instead</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.typeWrap}>
              <TextInput
                style={styles.typeInput}
                value={typed}
                onChangeText={setTyped}
                placeholder="when you're ready"
                placeholderTextColor="rgba(255,255,255,0.28)"
                multiline
                autoFocus
                testID="capture-text-input"
              />
              <Pressable
                onPress={keepTyped}
                style={[styles.keep, { opacity: typed.trim() ? 1 : 0.35 }]}
                testID="capture-keep"
              >
                <Text style={styles.keepText}>keep this →</Text>
              </Pressable>
              <Pressable
                onPress={() => setTypeMode(false)}
                hitSlop={10}
                style={styles.typeToggle}
                testID="capture-speak-instead"
              >
                <Text style={styles.typeToggleText}>speak instead</Text>
              </Pressable>
            </View>
          )}

          {warmUp.length > 0 && (
            <View style={styles.wayInWrap}>
              {!warmUpOpen ? (
                <Pressable
                  onPress={() => setWarmUpOpen(true)}
                  hitSlop={10}
                  style={styles.wayInToggle}
                  testID="capture-way-in"
                >
                  <Text style={styles.wayInLabel}>NEED A WAY IN? ↓</Text>
                </Pressable>
              ) : (
                <View testID="capture-way-in-open">
                  {warmUp.map((p) => (
                    <Text key={p.id} style={styles.wayInPrompt}>
                      {p.text}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </KeyboardAwareScrollViewCompat>
      )}

      {/* ── The beautiful hold ── */}
      {stage === "hold" && (
        <View style={[styles.fill, styles.holdCenter]} testID="hold-screen">
          <Text style={styles.holdLine}>Holding your words.</Text>
          <Text style={styles.holdGlyph}>⟡</Text>
        </View>
      )}

      {/* ── Counterweight resolution ── */}
      {stage === "counterweight" && cw && (
        <View
          style={[
            styles.fill,
            styles.cwContent,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 },
          ]}
          testID="counterweight-screen"
        >
          {woven ? <Text style={styles.wovenLine}>“{woven}”</Text> : null}

          <Svg
            width={230}
            height={Math.min(210, Math.round(230 * cw.ratio))}
            viewBox={cw.vb}
            style={styles.cwMap}
          >
            <Path d={cw.arc} stroke="rgba(255,255,255,0.16)" strokeWidth={1} fill="none" />
            {/* Still point */}
            <Circle cx={CX} cy={CY} r={1.6} fill="rgba(255,255,255,0.5)" />
            {/* Now */}
            <Circle cx={cw.pNow.x} cy={cw.pNow.y} r={5} fill="rgba(255,255,255,0.14)" />
            <Circle cx={cw.pNow.x} cy={cw.pNow.y} r={2.4} fill="rgba(255,255,255,0.92)" />
            {/* The counterweight, glowing in its station color — layered, no gradients */}
            <Circle cx={cw.pCw.x} cy={cw.pCw.y} r={9} fill={cw.color} opacity={0.14} />
            <Circle cx={cw.pCw.x} cy={cw.pCw.y} r={5} fill={cw.color} opacity={0.32} />
            <Circle cx={cw.pCw.x} cy={cw.pCw.y} r={2.2} fill={cw.color} opacity={0.95} />
          </Svg>

          <Text style={styles.cwEyebrow}>YOUR COUNTERWEIGHT TODAY</Text>
          <Text style={styles.cwDate}>{cw.dateLabel}</Text>
          <Text style={styles.cwQuestion}>{cw.question}</Text>

          <Pressable
            onPress={() => {
              setSheetKind("counterweight");
              setSheetOpen(true);
            }}
            hitSlop={10}
            style={styles.cwKeep}
            testID="counterweight-keep"
          >
            <Text style={styles.cwKeepText}>keep what comes →</Text>
          </Pressable>

          <Pressable
            onPress={() => (postBlocks.length > 0 ? toBlock(1) : toClose())}
            style={styles.advance}
            testID="counterweight-continue"
          >
            <Text style={styles.advanceText}>continue →</Text>
          </Pressable>
        </View>
      )}

      {/* ── Post-capture blocks ── */}
      {stage === "block" && block && (
        <View
          style={[
            styles.fill,
            styles.blockContent,
            { paddingTop: insets.top + 88, paddingBottom: insets.bottom + 40 },
          ]}
          testID={`block-${blockIdx}`}
          {...pan.panHandlers}
        >
          {block.type === "integration" && (
            <>
              <Text style={styles.blockTitle}>{block.title}</Text>
              {block.durationLabel ? (
                <Text style={styles.blockDuration}>{block.durationLabel}</Text>
              ) : null}
              <Text style={styles.blockInstruction}>{block.instruction}</Text>

              {typeof encounter.deepDive === "string" && encounter.deepDive ? (
                <View style={styles.deepDiveWrap}>
                  {!deepDiveOpen ? (
                    <Pressable onPress={() => setDeepDiveOpen(true)} hitSlop={8}>
                      <Text style={styles.deepDiveOffer}>
                        there's more here, if you have time →
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.blockInstruction}>{encounter.deepDive}</Text>
                  )}
                </View>
              ) : null}

              <Pressable onPress={advanceBlock} style={styles.advance} testID="block-advance">
                <Text style={styles.advanceText}>when you're ready →</Text>
              </Pressable>
            </>
          )}

          {block.type === "carry" && (
            <>
              {block.intro ? <Text style={styles.carryIntro}>{block.intro}</Text> : null}
              <Text style={styles.carryClosing}>{block.closing}</Text>
              <Pressable onPress={advanceBlock} style={styles.advance} testID="block-advance">
                <Text style={styles.advanceText}>return to the map →</Text>
              </Pressable>
            </>
          )}

          {block.type === "reflection" && (
            <>
              {block.prompts.map((p) => (
                <Text key={p.id} style={styles.blockInstruction}>
                  {p.text}
                </Text>
              ))}
              <Pressable onPress={advanceBlock} style={styles.advance} testID="block-advance">
                <Text style={styles.advanceText}>when you're ready →</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* ── Close ── */}
      {stage === "close" && (
        <View
          style={[styles.fill, styles.closeContent, { paddingBottom: insets.bottom + 64 }]}
          testID="close-screen"
          {...pan.panHandlers}
        >
          <Text style={styles.epigraph}>{encounter.mapEpigraph ?? encounter.subtitle}</Text>
          <Text style={styles.closeReturnLine}>
            you can return to this day from the map, anytime.
          </Text>

          {showAccountMoment ? (
            <View style={styles.accountMoment} testID="account-moment">
              <Text style={styles.accountHeadline}>keep this.</Text>
              <Text style={styles.accountSubline}>
                and everything else that finds you.
              </Text>
              <TextInput
                style={styles.accountInput}
                value={accountEmail}
                onChangeText={setAccountEmail}
                placeholder="email"
                placeholderTextColor="rgba(255,255,255,0.28)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                testID="account-email"
              />
              <TextInput
                style={styles.accountInput}
                value={accountPassword}
                onChangeText={setAccountPassword}
                placeholder="password"
                placeholderTextColor="rgba(255,255,255,0.28)"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                testID="account-password"
              />
              {accountError ? (
                <Text style={styles.accountError}>{accountError}</Text>
              ) : null}
              <Pressable
                onPress={linkAccount}
                style={[
                  styles.accountKeep,
                  { opacity: accountEmail.trim() && accountPassword ? 1 : 0.35 },
                ]}
                testID="account-keep"
              >
                <Text style={styles.keepText}>keep it →</Text>
              </Pressable>
              <Pressable
                onPress={() => setAccountDismissed(true)}
                hitSlop={10}
                style={styles.accountDismiss}
                testID="account-dismiss"
              >
                <Text style={styles.accountDismissText}>not now</Text>
              </Pressable>
            </View>
          ) : showMorningCallMoment ? (
            <MorningCallMoment
              onAllow={(choice) => {
                allowMorningCall(choice);
              }}
              onDismiss={() => setMorningCallDismissed(true)}
            />
          ) : (
            <Pressable onPress={closeOut} style={styles.advance} testID="close-return">
              <Text style={styles.advanceText}>return to the map →</Text>
            </Pressable>
          )}
        </View>
      )}

      <CaptureSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        uid={uid}
        // Counterweight capture (§6): a spontaneous reflection the map
        // provoked — no encounterRef. The ambient + stays 'encounter'.
        source={sheetKind === "counterweight" ? "spontaneous" : "encounter"}
        encounterRef={sheetKind === "counterweight" ? undefined : instanceId}
        atmosphere={phase}
        bottomPad={insets.bottom + 8}
        initialType={sheetKind === "counterweight" ? "reflection" : undefined}
        mapRef={
          sheetKind === "counterweight" && cw
            ? { date: cw.dateISO, phase: cw.phase }
            : null
        }
        onSaved={() => setToast({ key: Date.now(), text: "kept." })}
      />
      <QuietToast
        toast={toast}
        bottom={insets.bottom + 90}
        onDone={() => setToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  fill: {
    flex: 1,
  },
  darken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,1,8,0.45)",
  },

  backChevron: {
    position: "absolute",
    left: 18,
    zIndex: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backChevronText: {
    fontSize: 26,
    lineHeight: 30,
    color: "rgba(255,255,255,0.35)",
  },
  ambientPlus: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientPlusText: {
    fontSize: 24,
    lineHeight: 28,
    color: "rgba(255,255,255,0.4)",
  },

  // Listen
  listenCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breathDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  listenControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  listenSide: {
    flex: 1,
    alignItems: "flex-end",
  },
  playPause: {
    minWidth: 88,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseText: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.7)",
  },
  skip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.35)",
  },

  // ⟡ Capture
  captureContent: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  glyph: {
    fontSize: 22,
    color: GLYPH_BLUE,
    marginBottom: 18,
  },
  captureEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 26,
  },
  capturePrompt: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 24,
    lineHeight: 36,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 14,
  },
  captureSubtext: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    maxWidth: 300,
  },

  recordWrap: {
    alignItems: "center",
    marginTop: 44,
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
  typeToggle: {
    marginTop: 26,
    minHeight: 44,
    justifyContent: "center",
  },
  typeToggleText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },

  typeWrap: {
    width: "100%",
    marginTop: 36,
  },
  typeInput: {
    minHeight: 120,
    maxHeight: 220,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontFamily: FontFamily.sans400,
    fontSize: 15,
    lineHeight: 23,
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

  // Hold
  holdCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  holdLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 19,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  holdGlyph: {
    marginTop: 22,
    fontSize: 18,
    color: GLYPH_BLUE,
    opacity: 0.8,
  },

  // Counterweight
  cwContent: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  wovenLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 19,
    lineHeight: 29,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },
  cwMap: {
    marginTop: 30,
    marginBottom: 26,
  },
  cwEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.42)",
    marginBottom: 10,
  },
  cwDate: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 18,
  },
  cwQuestion: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 28,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    maxWidth: 310,
  },
  cwKeep: {
    marginTop: 22,
    minHeight: 44,
    justifyContent: "center",
  },
  cwKeepText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "underline",
  },

  // Blocks
  blockContent: {
    paddingHorizontal: 32,
  },
  blockTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 21,
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 8,
  },
  blockDuration: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.38)",
    marginBottom: 22,
  },
  blockInstruction: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 28,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 22,
  },
  deepDiveWrap: {
    marginBottom: 8,
  },
  deepDiveOffer: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
    marginBottom: 22,
  },
  carryIntro: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 18,
  },
  carryClosing: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 21,
    lineHeight: 33,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 26,
  },

  advance: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingRight: 12,
    marginTop: "auto",
  },
  advanceText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.62)",
  },

  // Close
  closeContent: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 36,
  },
  epigraph: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 22,
    lineHeight: 34,
    color: "rgba(255,255,255,0.93)",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 20,
  },
  closeReturnLine: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 40,
  },

  // Warm-up reveal (NEED A WAY IN?)
  wayInWrap: {
    marginTop: 34,
    width: "100%",
    alignItems: "center",
  },
  wayInToggle: {
    minHeight: 44,
    justifyContent: "center",
  },
  wayInLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.38)",
  },
  wayInPrompt: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 16,
  },

  // The account moment
  accountMoment: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  accountHeadline: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 26,
    lineHeight: 34,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginBottom: 6,
  },
  accountSubline: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 26,
  },
  accountInput: {
    width: "100%",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontFamily: FontFamily.sans400,
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 12,
  },
  accountError: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    lineHeight: 19,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    maxWidth: 300,
    marginTop: 2,
    marginBottom: 8,
  },
  accountKeep: {
    alignSelf: "flex-end",
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 44,
    justifyContent: "center",
    marginTop: 6,
  },
  accountDismiss: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: 8,
  },
  accountDismissText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.4)",
  },
});
