import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
import { QuietToast } from "@/components/OriginSheets";
import { FontFamily, TypeScale } from "@/constants/typography";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AccountForm } from "@/components/AccountForm";
import { LinkPrimary, LinkWhisper, LinkSecondary } from "@/components/Links";
import { wasMorningCallOffered } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  HELD_SILENCE_MS,
  HOLD_TIMEOUT_MS,
  buildEncounterSession,
  consumeEncounterSession,
  crystallizingPrompt,
  renderablePostBlocks,
  warmUpPrompts,
  wovenLine,
  type EncounterSession,
} from "@/lib/encounter";
import {
  completeEncounter,
  createFieldNote,
  fetchEncounterLibrary,
  fieldNoteRef,
  newFieldNoteId,
  saveAudioPosition,
  saveBlockIndex,
  uploadCaptureAudio,
  userEncounterId,
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import {
  CX,
  CY,
  MAX_AGE,
  PHASE_ACCENT,
  ageAt,
  counterweightDate,
  counterweightQuestionForDay,
  pt,
  resolve,
  ritualDateLabel,
  spiralPath,
  type CounterweightPools,
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

type Stage = "listen" | "capture" | "hold" | "counterweight" | "block" | "close";

/**
 * The encounter (§1) — a held space. No tab bar, no progress indicators,
 * one screen per state: Listen → ⟡ Capture → [Hold] → Counterweight →
 * post-capture blocks → Close. Arriving without a session (deep link,
 * reload) returns quietly to the tabs.
 */
export default function EncounterScreen() {
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ e?: string; t?: string; m?: string }>();

  // Consume the hand-off exactly once, before first render commits.
  const handedRef = useRef<EncounterSession | null | undefined>(undefined);
  if (handedRef.current === undefined) {
    handedRef.current = consumeEncounterSession();
  }

  // The hand-off is a module variable: it does not survive the JS context
  // being reclaimed while backgrounded (leaving to check Photos mid-encounter),
  // nor any remount. The route params are the durable record of WHICH
  // encounter this screen is, so when the hand-off is gone we rebuild from
  // Firestore rather than quietly restarting the practitioner's day.
  const [rebuilt, setRebuilt] = useState<EncounterSession | null>(null);
  const [unrecoverable, setUnrecoverable] = useState(false);
  const session = handedRef.current ?? rebuilt;

  const encounterId = typeof params.e === "string" ? params.e : null;
  const turn = Number(params.t);
  const visiting = params.m === "visit";

  useEffect(() => {
    if (session || authLoading || !user) return;
    if (!encounterId || !Number.isFinite(turn)) {
      // A genuine deep link with nothing to resume — the old behavior.
      setUnrecoverable(true);
      return;
    }
    let on = true;
    (async () => {
      try {
        const library = await fetchEncounterLibrary();
        const encounter = library.find((e) => e.id === encounterId);
        if (!encounter) throw new Error(`encounter ${encounterId} not in library`);
        const s = await buildEncounterSession(user.uid, encounter, turn, { visiting });
        if (on) setRebuilt(s);
      } catch (err) {
        console.warn("[encounter] session rebuild failed", err);
        if (on) setUnrecoverable(true);
      }
    })();
    return () => {
      on = false;
    };
  }, [session, authLoading, user, encounterId, turn, visiting]);

  // Leave only when there is genuinely nothing to return to. Auth rehydrating
  // on a cold start is NOT that: `user` is null for a beat while the anonymous
  // session restores, and bouncing during that beat is the second path by
  // which a backgrounded morning looked like it had started over.
  useEffect(() => {
    if (authLoading) return;
    if (!user || unrecoverable) router.replace("/(tabs)");
  }, [authLoading, user, unrecoverable]);

  if (!session || !user) {
    return <View style={styles.container} />;
  }
  return <EncounterFlow session={session} uid={user.uid} />;
}

function EncounterFlow({ session, uid }: { session: EncounterSession; uid: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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
  // E5 — ONE close screen: carry blocks stay dropped. F3 — the screen
  // sequence is generated from the encounter's block array; a screen
  // exists only if its block has content. Skipped blocks are logged so
  // bad content is caught, never silently swallowed.
  const postBlocks = useMemo(() => {
    const { blocks, skipped } = renderablePostBlocks(encounter.blocks);
    for (const s of skipped) {
      console.warn(
        `[encounter] block with no renderable content skipped — ${encounter.id} block[${s.index}] (${s.type})`
      );
    }
    return blocks;
  }, [encounter.blocks, encounter.id]);
  // §5 — warm-ups live behind the collapsed reveal, never listed openly.
  const warmUps = useMemo(() => warmUpPrompts(encounter.blocks), [encounter.blocks]);
  const [wayInOpen, setWayInOpen] = useState(false);

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

  // H2 — whether this encounter's ⟡ note is already kept (this session OR a
  // resume that landed past capture). Backing into a kept capture shows it
  // as historical — never a second submittable prompt.
  const [kept, setKept] = useState(() => {
    const r = session.resume;
    return !!(r && (r.blockIndex >= 1 || r.crystallizing));
  });
  const keptContentRef = useRef<string | null>(session.resume?.crystallizing?.content ?? null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Task C §2 — the "keep this." moment: at most once, EVER. The shown-flag
  // is persisted both locally and on the user doc, so a dismissal is never
  // re-triggered by the second close (Settings is the only path back).
  // "First encounter close while anonymous" is the intended proxy — the
  // close screen only exists past the ⟡, so no capture counting is needed;
  // visit-mode closes count too. Notes-only users never see it: accepted,
  // Settings covers them.
  const [keepThisVisible, setKeepThisVisible] = useState(false);
  const [keepThisOpen, setKeepThisOpen] = useState(false);
  const [keptForGood, setKeptForGood] = useState(false);
  const keepThisFiredRef = useRef(false);
  useEffect(() => {
    if (stage !== "close" || !user?.isAnonymous || keepThisFiredRef.current) return;
    // Wait for the profile — deciding before the user doc loads could
    // re-show the offer on a fresh install of a field that already saw it.
    // (Effect re-runs when the snapshot arrives.)
    if (!profile) return;
    keepThisFiredRef.current = true;
    if (profile.keepThisOffered) return; // already fired on another device/install
    AsyncStorage.getItem("mineral_keep_this_offered")
      .then((v) => {
        if (v !== "1") {
          setKeepThisVisible(true);
          AsyncStorage.setItem("mineral_keep_this_offered", "1").catch(() => {});
          updateProfile({ keepThisOffered: true }).catch(() => {});
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, user, profile]);

  // The one capture sheet, parametrized by its trigger: the ambient `+`
  // (source 'encounter') or the counterweight's "keep what comes" (§6).
  const [sheetMode, setSheetMode] = useState<null | "ambient" | "counterweight">(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  // ── Listen (§1b) ──
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);
  const startedRef = useRef(false);
  const heldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Slice 3 — audio keeps playing when the app backgrounds (with
    // UIBackgroundModes: ["audio"] in app.json). expo-audio's name for
    // expo-av's `staysActiveInBackground`.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
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

  // Slice 3.1 — backgrounded narration keeps playing (supersedes Task B §1b's
  // background→pause for the listen stage). Interruptions (phone call, another
  // app's audio) pause the player at the OS level; we detect the involuntary
  // stop and persist audioPosition so resume-in-place still works.
  const userPausedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    const was = wasPlayingRef.current;
    wasPlayingRef.current = status.playing;
    if (
      was &&
      !status.playing &&
      stageRef.current === "listen" &&
      !status.didJustFinish &&
      !userPausedRef.current
    ) {
      persistPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.playing, status.didJustFinish]);

  // Slice 3.1 — persist audioPosition every ~5s during playback, however
  // playback later ends (lock, interruption, force-quit).
  useEffect(() => {
    if (stage !== "listen" || !status.playing) return;
    const iv = setInterval(persistPosition, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status.playing]);

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
    if (stage !== "listen" || !status.didJustFinish || relistenRef.current) return;
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

  // H2 — re-entering listen via back must not auto-bounce to capture off a
  // stale didJustFinish; cleared when the user plays or restarts (↺).
  const relistenRef = useRef(false);
  const toCapture = (skipped = false) => {
    try {
      player.pause();
    } catch {}
    if (mode === "sequence" && !skipped) {
      // Reaching the ⟡ naturally means the audio moment is spent.
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
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsRecording: true,
      });
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
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsRecording: false,
      });
      const uri = recorder.uri;
      // A grazed button is a breath, not a word — discard quietly.
      if (!uri || lastDurationRef.current < 700) return;
      keepVoice(uri);
    } catch (err) {
      console.warn("recording not kept", err);
    }
  };

  const keepVoice = (uri: string) => {
    if (savingRef.current || kept || !prompt) return;
    savingRef.current = true;
    setKept(true);
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
    if (!content || savingRef.current || kept || !prompt) return;
    savingRef.current = true;
    setKept(true);
    keptContentRef.current = content;
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
    if (content != null) keptContentRef.current = content;
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

  // H2 — quiet back (← or swipe-right) on EVERY step, strictly sequential:
  // close → last block → … → counterweight → ⟡ prompt → the audio screen.
  // The hold is transient (a note is landing) and the audio screen is first,
  // so neither carries a back.
  // Entering the counterweight from EITHER direction — a resume at a later
  // block never showed it this mount, so the woven line may need weaving
  // from the kept note (null content weaves the question alone).
  const toCounterweight = () => {
    if (!woven && prompt) setWoven(wovenLine(keptContentRef.current, prompt.text));
    setCwShown(true);
    setStage("counterweight");
  };
  const goBack = () => {
    if (stage === "close") {
      if (postBlocks.length > 0) toBlock(postBlocks.length);
      else if (cwShown || cwAvailable) toCounterweight();
      else setStage("capture");
      return;
    }
    if (stage === "block") {
      if (blockIdx > 1) toBlock(blockIdx - 1);
      else if (cwShown || cwAvailable) toCounterweight();
      else setStage("capture");
      return;
    }
    if (stage === "counterweight") {
      setStage("capture");
      return;
    }
    if (stage === "capture") {
      relistenRef.current = true;
      setStage("listen");
    }
  };
  const canGoBack = stage !== "listen" && stage !== "hold";

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
  // Slice 6: the permission moment fires once, after the FIRST close (the
  // account moment, if it triggers, has already run inside the close stage).
  const morningCallOfferedRef = useRef(true);
  useEffect(() => {
    if (Platform.OS === "web") return; // notifications are native-only
    wasMorningCallOffered()
      .then((v) => {
        morningCallOfferedRef.current = v;
      })
      .catch(() => {});
  }, []);
  const closeOut = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (sequence) {
      // Not awaited — offline, the batch commits when connectivity returns;
      // the local snapshot already advances the CTA (§4).
      completeEncounter(uid, encounter.id, turn, profile?.sequenceDay ?? 1).catch(
        (err) => console.warn("completion queued/failed", err)
      );
    }
    // Re-read the flag at the moment of decision — the mount-time preload
    // may not have resolved on a very fast first close.
    let offered = morningCallOfferedRef.current;
    if (sequence && Platform.OS !== "web") {
      offered = await wasMorningCallOffered().catch(() => offered);
    }
    if (sequence && Platform.OS !== "web" && !offered) {
      router.replace("/morning-call");
      return;
    }
    router.replace("/(tabs)/origin");
  };

  // F6 — practitioner-editable counterweight pools. One quiet read; on
  // any failure the client falls back to the built-in single questions.
  const [cwPools, setCwPools] = useState<CounterweightPools | null>(null);
  useEffect(() => {
    let on = true;
    getDoc(doc(db, "practitionerContent", "counterweight_pools"))
      .then((snap) => {
        if (!on || !snap.exists()) return;
        const pools = (snap.data() as { pools?: CounterweightPools }).pools;
        if (pools) setCwPools(pools);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  // ── Counterweight geometry (§1e) — Task A spiral math at small scale ──
  const cw = useMemo(() => {
    if (!cwAvailable || currentAge == null || !birthDate) return null;
    const cwAge = currentAge - 14;
    const r = resolve(cwAge);
    const date = counterweightDate(birthDate.toDate(), new Date(), currentAge, currentAge);
    const isoDate = date.toISOString().slice(0, 10);
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
      // F6 — rotate the angle, keep the season: deterministic daily pick.
      question: counterweightQuestionForDay(r.phase, profile?.sequenceDay ?? 1, cwPools),
      phase: r.phase,
      isoDate,
      color: r.station.color,
      dateLabel: ritualDateLabel(date),
      arc: spiralPath(Math.max(0, cwAge - 3), Math.min(MAX_AGE, currentAge + 3)),
      pNow,
      pCw,
      vb: `${minX} ${minY} ${w} ${h}`,
      ratio: h / w,
    };
  }, [cwAvailable, currentAge, birthDate, cwPools, profile?.sequenceDay]);

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

      {/* H2 — quiet back ←, top-left, whisper register, every step */}
      {canGoBack && sheetMode == null && (
        <Pressable
          onPress={goBack}
          hitSlop={14}
          style={[styles.backChevron, { top: insets.top + 14 }]}
          testID="encounter-back"
        >
          <Text style={styles.backChevronText}>←</Text>
        </Pressable>
      )}

      {/* F2 — the quiet exit ✕: every screen, top-right, no confirm.
          Exit only navigates; whatever is already kept stays kept. */}
      {sheetMode == null && (
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          hitSlop={14}
          style={[styles.exitX, { top: insets.top + 14 }]}
          testID="encounter-exit"
        >
          <Text style={styles.exitXText}>✕</Text>
        </Pressable>
      )}

      {/* Ambient + — block screens only, never the ⟡ (§1f). Shifted left
          of the ✕ since F2 gave the corner to the exit. */}
      {stage === "block" && (
        <Pressable
          onPress={() => setSheetMode("ambient")}
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
            <View style={[styles.listenSide, styles.listenSideLeft]}>
              {/* H2 — ↺ restarts the audio from the beginning, whether the
                  user arrived by resume, back-navigation, or mid-listen. */}
              <Pressable
                onPress={() => {
                  relistenRef.current = false;
                  userPausedRef.current = false;
                  try {
                    player.seekTo(0);
                  } catch {}
                  player.play();
                }}
                style={styles.replayTarget}
                hitSlop={10}
                testID="listen-replay"
              >
                <Text style={styles.replayText}>↺</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                // Explicit user pause — unchanged behavior (Slice 3.1 only
                // marks it so it isn't mistaken for an interruption).
                userPausedRef.current = status.playing;
                if (status.playing) player.pause();
                else {
                  relistenRef.current = false;
                  player.play();
                }
              }}
              style={styles.playPause}
              hitSlop={8}
              testID="listen-toggle"
            >
              <Text style={styles.playPauseText}>{status.playing ? "pause" : "play"}</Text>
            </Pressable>
            <View style={styles.listenSide}>
              <LinkWhisper label="skip →" onPress={() => toCapture(true)} testID="listen-skip" />
            </View>
          </View>
        </View>
      )}

      {/* H2 — E6's `← the voice` is absorbed by the generalized back: the ←
          on the ⟡ prompt IS the way to the voice, so the special-case
          whisper is removed. */}

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

          {/* §5 — warm-ups stay collapsed; the ⟡ leads with one prompt, one capture */}
          {!kept && warmUps.length > 0 && (
            <View style={styles.wayInWrap}>
              {!wayInOpen ? (
                /* T-c follow-up §2: disclosure control, not a link — eyebrow
                   register, no hairline; the ↓ is its only signifier. */
                <Pressable
                  onPress={() => setWayInOpen(true)}
                  style={({ pressed }) => [
                    styles.wayInEyebrowHit,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  testID="capture-way-in"
                >
                  <Text style={styles.wayInEyebrow}>NEED A WAY IN? ↓</Text>
                </Pressable>
              ) : (
                warmUps.map((p) => (
                  <Text key={p.id} style={styles.wayInPrompt}>
                    {p.text}
                  </Text>
                ))
              )}
            </View>
          )}

          {kept ? (
            /* H2 — backing into a kept ⟡: historical, never re-submittable.
               Continue is the step's own primary action, forward as usual. */
            <View style={styles.keptWrap}>
              <Text style={styles.keptLine} testID="capture-kept-line">
                already kept.
              </Text>
              <LinkPrimary
                label="continue →"
                onPress={() => {
                  if (cwShown || cwAvailable) toCounterweight();
                  else if (postBlocks.length > 0) toBlock(1);
                  else toClose();
                }}
                style={{ alignSelf: "center", marginTop: 10 }}
                testID="capture-kept-continue"
              />
            </View>
          ) : !typeMode ? (
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
              <LinkSecondary
                label="type instead"
                onPress={() => setTypeMode(true)}
                style={{ marginTop: 26, alignSelf: "center" }}
                testID="capture-type-instead"
              />
            </View>
          ) : (
            <View style={styles.typeWrap}>
              <TextInput
                style={styles.typeInput}
                value={typed}
                onChangeText={setTyped}
                placeholder="when you're ready"
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                autoFocus
                testID="capture-text-input"
              />
              <LinkPrimary
                label="keep this →"
                onPress={keepTyped}
                style={{ alignSelf: "flex-end", opacity: typed.trim() ? 1 : 0.35 }}
                testID="capture-keep"
              />
              <LinkSecondary
                label="speak instead"
                onPress={() => setTypeMode(false)}
                style={{ marginTop: 26 }}
                testID="capture-speak-instead"
              />
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
      {stage === "counterweight" && cw && sheetMode !== "counterweight" && (
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

          {/* §6 — one quiet line, never a form */}
          <LinkWhisper
            label="keep what comes →"
            onPress={() => setSheetMode("counterweight")}
            style={{ marginTop: 22, alignSelf: "center" }}
            testID="counterweight-keep"
          />

          <LinkPrimary
            label="continue →"
            onPress={() => (postBlocks.length > 0 ? toBlock(1) : toClose())}
            style={styles.advance}
            testID="counterweight-continue"
          />
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
              {/* 2.1.3 — the day's ⟡ prompt stays present above the title,
                  so integration reads as a continuation, not a new screen. */}
              {prompt ? (
                <Text style={styles.blockDayPrompt} testID="integration-day-prompt">
                  ⟡ {prompt.text}
                </Text>
              ) : null}
              <Text style={styles.blockTitle}>{block.title}</Text>
              {block.durationLabel ? (
                <Text style={styles.blockDuration}>{block.durationLabel}</Text>
              ) : null}
              <Text style={styles.blockInstruction}>{block.instruction}</Text>

              {typeof encounter.deepDive === "string" && encounter.deepDive ? (
                <View style={styles.deepDiveWrap}>
                  {!deepDiveOpen ? (
                    <LinkWhisper
                      label="there's more here, if you have time →"
                      onPress={() => setDeepDiveOpen(true)}
                    />
                  ) : (
                    <Text style={styles.blockInstruction}>{encounter.deepDive}</Text>
                  )}
                </View>
              ) : null}

              <LinkPrimary
                label="when you're ready →"
                onPress={advanceBlock}
                style={styles.advance}
                testID="block-advance"
              />
            </>
          )}

          {block.type === "reflection" && (
            <ReflectionBlockBody block={block} onAdvance={advanceBlock} />
          )}
        </View>
      )}

      {/* ── Close ── */}
      {stage === "close" && (
        <View
          style={[
            styles.fill,
            styles.closeContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 64 },
          ]}
          testID="close-screen"
          {...pan.panHandlers}
        >
          {/* E5 — the canonical close: the epigraph centered in the upper
              third, fully visible above the single CTA. */}
          <View style={styles.epigraphZone}>
            <Text style={styles.epigraph}>{encounter.mapEpigraph ?? encounter.subtitle}</Text>
          </View>
          {/* §5 — said once, on the way out */}
          <Text style={styles.returnLine}>
            you can return to this day from the map, anytime.
          </Text>

          {/* Task C §2 — the "keep this." moment, once, after the first
              crystallizing capture, only while the session is anonymous. */}
          {keepThisVisible && (
            <View style={styles.keepThisWrap} testID="keep-this-offer">
              {keptForGood ? (
                <Text style={styles.keepThisLead}>kept. this field is yours, anywhere.</Text>
              ) : keepThisOpen ? (
                <>
                  <Text style={styles.keepThisLead}>
                    an email and a password, and this field is yours anywhere.
                  </Text>
                  <AccountForm mode="link" onDone={() => setKeptForGood(true)} />
                </>
              ) : (
                <>
                  <Text style={styles.keepThisLead}>
                    what you kept today lives only on this device.
                  </Text>
                  <LinkPrimary
                    label="keep this. →"
                    onPress={() => setKeepThisOpen(true)}
                    style={{ alignSelf: "center" }}
                    testID="keep-this-open"
                  />
                </>
              )}
            </View>
          )}

          <LinkPrimary
            label="return to the map →"
            onPress={closeOut}
            style={styles.advance}
            testID="close-return"
          />
        </View>
      )}

      <CaptureSheet
        open={sheetMode != null}
        onClose={() => setSheetMode(null)}
        uid={uid}
        source={sheetMode === "counterweight" ? "spontaneous" : "encounter"}
        encounterRef={sheetMode === "counterweight" ? null : instanceId}
        atmosphere={phase}
        bottomPad={insets.bottom + 8}
        lockedType={sheetMode === "counterweight" ? "reflection" : null}
        eyebrow={sheetMode === "counterweight" ? "KEEP WHAT COMES" : "CAPTURE"}
        // The date and question stay on screen while they are answered.
        contextDate={sheetMode === "counterweight" ? (cw?.dateLabel ?? null) : null}
        promptText={sheetMode === "counterweight" ? (cw?.question ?? null) : null}
        mapRef={
          sheetMode === "counterweight" && cw
            ? { date: cw.isoDate, phase: cw.phase }
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

/** §5 — extra prompt material is offered ONCE, quietly, after the ⟡ —
 *  never as a wall of inputs. */
function ReflectionBlockBody({
  block,
  onAdvance,
}: {
  block: Extract<EncounterBlock, { type: "reflection" }>;
  onAdvance: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      {!revealed ? (
        <LinkWhisper
          label="there's more here, if you have time →"
          onPress={() => setRevealed(true)}
          testID="block-more-here"
        />
      ) : (
        block.prompts.map((p) => (
          <Text key={p.id} style={styles.blockInstruction}>
            {p.text}
          </Text>
        ))
      )}
      <LinkPrimary
        label="when you're ready →"
        onPress={onAdvance}
        style={styles.advance}
        testID="block-advance"
      />
    </>
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
    // H2 — whisper register (ritual dim-lavender), navGlyph optical size so
    // the ← sits in balance with the ✕ opposite it.
    ...TypeScale.navGlyph,
    color: "rgba(200,190,225,0.55)",
  },
  ambientPlus: {
    position: "absolute",
    // F2 — shifted left of the exit ✕, which now owns the corner.
    right: 62,
    zIndex: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientPlusText: {
    ...TypeScale.screenTitle,
    color: "rgba(255,255,255,0.5)",
  },
  // F2 — quiet exit: 24pt glyph (navGlyph token) in a 44pt target,
  // textTertiary, no confirm.
  exitX: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  exitXText: {
    ...TypeScale.navGlyph,
    color: "rgba(255,255,255,0.58)",
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
  listenSideLeft: {
    alignItems: "flex-start",
  },
  replayTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  replayText: {
    // H2 — same quiet register as the transport controls.
    ...TypeScale.body,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.72)",
  },
  playPause: {
    minWidth: 88,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseText: {
    ...TypeScale.body,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.72)",
  },

  // H2 — the kept (historical) ⟡
  keptWrap: {
    marginTop: 40,
    alignItems: "center",
  },
  keptLine: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.6)",
  },

  // ⟡ Capture
  captureContent: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  glyph: {
    ...TypeScale.screenTitle,
    color: GLYPH_BLUE,
    marginBottom: 18,
  },
  captureEyebrow: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 26,
  },
  capturePrompt: {
    ...TypeScale.serifTitle,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 14,
  },
  captureSubtext: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
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
    ...TypeScale.metadata,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.5)",
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
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    textAlignVertical: "top",
  },
  // Hold
  holdCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  holdLine: {
    ...TypeScale.serifLarge,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  holdGlyph: {
    marginTop: 22,
    ...TypeScale.sectionTitle,
    color: GLYPH_BLUE,
    opacity: 0.8,
  },

  // Counterweight
  cwContent: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  wovenLine: {
    ...TypeScale.serifMedium,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },
  cwMap: {
    marginTop: 30,
    marginBottom: 26,
  },
  cwEyebrow: {
    ...TypeScale.micro,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
  },
  cwDate: {
    ...TypeScale.body,
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 18,
  },
  cwQuestion: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    maxWidth: 310,
  },

  wayInWrap: {
    marginTop: 22,
    alignItems: "center",
  },
  // ≥44pt tap target: 14 line-height + 2×15 padding
  wayInEyebrowHit: {
    alignSelf: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  wayInEyebrow: {
    ...TypeScale.eyebrow,
    color: "rgba(255,255,255,0.5)",
  },
  wayInPrompt: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 12,
  },

  // Blocks
  blockContent: {
    paddingHorizontal: 32,
  },
  blockDayPrompt: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
  },
  blockTitle: {
    ...TypeScale.screenTitle,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 8,
  },
  blockDuration: {
    ...TypeScale.micro,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 22,
  },
  blockInstruction: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 22,
  },
  deepDiveWrap: {
    marginBottom: 8,
  },
  // E6 — top-left whisper back to the audio, skip arrivals only

  advance: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingRight: 12,
    marginTop: "auto",
  },

  keepThisWrap: {
    alignSelf: "stretch",
    maxWidth: 320,
    marginBottom: 30,
  },
  keepThisLead: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    marginBottom: 10,
  },
  returnLine: {
    ...TypeScale.label,
    fontFamily: FontFamily.sans400,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 30,
  },

  // Close
  closeContent: {
    alignItems: "center",
    paddingHorizontal: 36,
  },
  // E5 — the upper third holds the epigraph, vertically centered.
  epigraphZone: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34%",
    marginBottom: 24,
  },
  epigraph: {
    ...TypeScale.serifLarge,
    color: "rgba(255,255,255,0.93)",
    textAlign: "center",
    maxWidth: 320,
  },
});
