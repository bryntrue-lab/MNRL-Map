import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OriginAtmosphere } from "@/components/Atmosphere";
import { CaptureSheet } from "@/components/CaptureSheet";
import Cta from "@/components/Cta";
import { LinkWhisper } from "@/components/Links";
import { CompanionsSheet, QuietToast, ReadingSheet } from "@/components/OriginSheets";
import { OriginMap, TurnWheel, type OriginMapVisual } from "@/components/SpiralComponents";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  dayOfEncounter,
  fetchEncounterLibrary,
  getUserEncounter,
  selectEncounterForDay,
  syncPracticePosition,
  turnEncountersQuery,
  type EncounterWithId,
} from "@/lib/firestore";
import {
  MAP_H,
  MAP_W,
  MAX_AGE,
  QUARTERS,
  STATION,
  ageAt,
  ageFromPointer,
  dateAtAge,
  dayInTurn,
  monthYearLabel,
  phaseOfDay,
  practiceTurnOf,
  pt,
  resolve,
  wheelDayFromPoint,
  word,
  type Quarter,
} from "@/lib/spiral";
import { setVisitDay } from "@/lib/visitStore";
import type { PhaseId, UserEncounterDoc } from "@/types/firestore";

// §3 pinch-zoom bounds — magnification only, never the fractal zoom.
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
type ZoomState = { s: number; tx: number; ty: number };
const ZOOM_HOME: ZoomState = { s: 1, tx: 0, ty: 0 };

const INTRO_KEY = "mineral_origin_intro_played";
const HINT_KEY = "mineral_origin_hint_done";

const PHASE_DISPLAY: Record<PhaseId, string> = {
  signal: "the signal",
  field: "the field",
  friction: "the friction",
  voice: "the voice",
};

// ─────────────────────────────────────────────────────────────
// Timing + easing
// ─────────────────────────────────────────────────────────────

const nowMs = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutQuad = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeInOutCubic = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

/** RAF-eased number that follows `target`. Drives SVG props via state. */
function useEasedValue(target: number, duration: number): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (Math.abs(valueRef.current - target) < 0.001) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const from = valueRef.current;
    const start = nowMs();
    const step = () => {
      const k = clamp01((nowMs() - start) / duration);
      const v = from + (target - from) * easeInOutQuad(k);
      valueRef.current = v;
      setValue(v);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ─────────────────────────────────────────────────────────────
// First-run choreography (§8) — ~12.5s, any tap skips, plays once.
// blackout → still point → lived line outside-in (stations + crossings
// arriving as passed) → future line → needle → NOW + counterline →
// words (HUD, epigraph, CTA, hint) → labels withdraw.
// ─────────────────────────────────────────────────────────────

// Slice 5 — the choreography is also played as onboarding step 4
// (app/onboarding/map.tsx); these exports let it reuse the exact §8
// sequence without duplicating it. The map's rendering is untouched.
export const INTRO_KEY_EXPORT = INTRO_KEY;
const INTRO_T0 = 2100;
const INTRO_D = 5600;
export const INTRO_TOTAL = INTRO_T0 + INTRO_D + 6000;

interface UiOpacity {
  hud: number;
  epi: number;
  cta: number;
  hint: number;
}

const UI_SETTLED: UiOpacity = { hud: 1, epi: 1, cta: 1, hint: 1 };

function introUi(t: number): UiOpacity {
  const base = INTRO_T0 + INTRO_D;
  return {
    hud: clamp01((t - (base + 2500)) / 800),
    epi: clamp01((t - (base + 3100)) / 800),
    cta: clamp01((t - (base + 3900)) / 800),
    hint: clamp01((t - (base + 4700)) / 800),
  };
}

const STATION_REVEAL_AGE: Record<Quarter, number> = { north: 0, east: 7, south: 14, west: 21 };

export function introVisual(t: number, currentAge: number): OriginMapVisual {
  const base = INTRO_T0 + INTRO_D;
  const withdraw = clamp01((t - (base + 4700)) / 1200);
  const lived = easeInOutCubic(clamp01((t - INTRO_T0) / INTRO_D));
  const drawnAge = lived * currentAge;

  const stationOpacity = { north: 0, east: 0, south: 0, west: 0 } as Record<Quarter, number>;
  QUARTERS.forEach((q) => {
    const reveal = STATION_REVEAL_AGE[q];
    const on =
      q === "north"
        ? t >= INTRO_T0
          ? 1
          : 0
        : currentAge >= reveal
          ? clamp01((drawnAge - reveal) / 2)
          : 0;
    stationOpacity[q] = 0.55 * on * (1 - withdraw);
  });

  return {
    blackout: 1 - clamp01((t - 300) / 1800),
    still: clamp01((t - 900) / 1400),
    lived,
    future: clamp01((t - (base + 200)) / 900),
    needle: easeInOutQuad(clamp01((t - (base + 600)) / 1100)),
    nowOn: clamp01((t - (base + 1700)) / 700),
    stationOpacity,
    yearsOpacity: 0.55 * clamp01((t - (INTRO_T0 + 600)) / 1200) * (1 - withdraw),
    arcsDim: 1,
  };
}

// ─────────────────────────────────────────────────────────────
// The Origin screen — §6–§10. Fixed layout, no scroll:
// HUD → epigraph (negative space above the map) → spiral zone →
// chip → word zone → CTA. Two clocks, never wired together.
// ─────────────────────────────────────────────────────────────

export default function OriginScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const tabBarHeight = isWeb ? 84 : 60 + insets.bottom;

  const { user } = useAuth();
  const { profile, updateProfile } = useUser();

  // ── The life clock ────────────────────────────────────────
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));

  const birthDate = useMemo(
    () => (profile?.birthDate ? profile.birthDate.toDate() : null),
    [profile?.birthDate]
  );
  const currentAge = birthDate ? ageAt(birthDate, now) : null;
  const clampedCurrent =
    currentAge != null ? Math.max(0.2, Math.min(currentAge, MAX_AGE - 0.2)) : null;

  // ── The practice clock ────────────────────────────────────
  const sequenceDay = profile?.sequenceDay ?? 1;
  const wheelDay = dayInTurn(sequenceDay);
  const practiceTurn = practiceTurnOf(sequenceDay);

  const [library, setLibrary] = useState<EncounterWithId[] | null>(null);
  useEffect(() => {
    let on = true;
    fetchEncounterLibrary()
      .then((l) => on && setLibrary(l))
      .catch((err) => console.warn("encounter library", err));
    return () => {
      on = false;
    };
  }, []);

  const encounter = useMemo(
    () => (library ? selectEncounterForDay(library, sequenceDay, practiceTurn) : null),
    [library, sequenceDay, practiceTurn]
  );

  // §5 — keep currentPhase / currentTurn in step; backfill sequenceDay.
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.sequenceDay == null) {
      updateProfile({ sequenceDay: 1 }).catch((err) => console.warn("sequenceDay backfill", err));
      return;
    }
    syncPracticePosition(user.uid, profile.sequenceDay, profile.currentPhase, profile.currentTurn).catch(
      (err) => console.warn("practice position sync", err)
    );
  }, [user, profile, updateProfile]);

  // userEncounters for this turn — wheel rings + CTA state.
  const [turnDocs, setTurnDocs] = useState<(UserEncounterDoc & { id: string })[]>([]);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      turnEncountersQuery(user.uid, practiceTurn),
      (snap) =>
        setTurnDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserEncounterDoc) }))),
      (err) => console.warn("turn encounters", err)
    );
    return unsub;
  }, [user, practiceTurn]);

  const visitedDays = useMemo(() => {
    const s = new Set<number>();
    if (!library) return s;
    const byId = new Map(library.map((e) => [e.id, e] as const));
    turnDocs.forEach((d) => {
      if (d.status !== "visited") return;
      const enc = byId.get(d.encounterId);
      if (enc) s.add(dayOfEncounter(enc));
    });
    return s;
  }, [turnDocs, library]);

  // Yesterday's instance — on day one of a new turn it lives in the PREVIOUS
  // turn, outside the turnDocs listener, so it needs a one-shot read.
  const prevSeq = sequenceDay - 1;
  const prevTurn = prevSeq >= 1 ? practiceTurnOf(prevSeq) : null;
  const prevEncounter = useMemo(
    () =>
      library && prevTurn != null ? selectEncounterForDay(library, prevSeq, prevTurn) : null,
    [library, prevSeq, prevTurn]
  );
  const [prevTurnDoc, setPrevTurnDoc] = useState<UserEncounterDoc | null>(null);
  useEffect(() => {
    if (!user || !prevEncounter || prevTurn == null || prevTurn === practiceTurn) {
      setPrevTurnDoc(null);
      return;
    }
    let on = true;
    getUserEncounter(user.uid, prevEncounter.id, prevTurn)
      .then((d) => on && setPrevTurnDoc(d))
      .catch(() => on && setPrevTurnDoc(null));
    return () => {
      on = false;
    };
  }, [user, prevEncounter, prevTurn, practiceTurn]);

  const ctaState: "today" | "continue" | "complete" = useMemo(() => {
    if (!encounter) return "today";
    const todayDoc = turnDocs.find((d) => d.encounterId === encounter.id);
    if (todayDoc?.status === "in-progress") return "continue";
    if (prevEncounter && prevTurn != null) {
      const prevDoc =
        prevTurn === practiceTurn
          ? turnDocs.find((d) => d.encounterId === prevEncounter.id)
          : prevTurnDoc;
      if (
        prevDoc?.status === "completed" &&
        prevDoc.completedAt &&
        prevDoc.completedAt.toDate().toDateString() === now.toDateString()
      )
        return "complete";
    }
    return "today";
  }, [encounter, turnDocs, prevEncounter, prevTurn, practiceTurn, prevTurnDoc, now]);

  // ── Local flags ───────────────────────────────────────────
  const [introPlayed, setIntroPlayed] = useState<boolean | null>(null);
  const [hintDone, setHintDone] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY)
      .then((v) => setIntroPlayed(v === "1"))
      .catch(() => setIntroPlayed(true));
    AsyncStorage.getItem(HINT_KEY)
      .then((v) => setHintDone(v === "1"))
      .catch(() => setHintDone(true));
  }, []);

  // ── Pendulum state ────────────────────────────────────────
  const [displayAge, setDisplayAgeState] = useState(0.2);
  const displayAgeRef = useRef(0.2);
  const setDisplayAge = useCallback((v: number) => {
    displayAgeRef.current = v;
    setDisplayAgeState(v);
  }, []);

  const swingRaf = useRef<number | null>(null);
  const swingTo = useCallback(
    (target: number, after?: () => void) => {
      if (swingRaf.current != null) cancelAnimationFrame(swingRaf.current);
      const from = displayAgeRef.current;
      const start = nowMs();
      const step = () => {
        const k = clamp01((nowMs() - start) / 900);
        setDisplayAge(from + (target - from) * easeInOutQuad(k));
        if (k < 1) swingRaf.current = requestAnimationFrame(step);
        else {
          swingRaf.current = null;
          after?.();
        }
      };
      swingRaf.current = requestAnimationFrame(step);
    },
    [setDisplayAge]
  );
  useEffect(
    () => () => {
      if (swingRaf.current != null) cancelAnimationFrame(swingRaf.current);
    },
    []
  );

  const [wandering, setWandering] = useState(false);
  const wanderFade = useEasedValue(wandering ? 1 : 0, 700);

  const [sheet, setSheet] = useState<null | "reading" | "companions">(null);
  const arcsDim = useEasedValue(sheet ? 0.55 : 1, 300);

  // §6 — counterweight capture: the position read when "keep what comes"
  // was offered. Non-null renders the standard capture sheet.
  const [cwCapture, setCwCapture] = useState<{ date: string; phase: PhaseId } | null>(null);

  const [turnOpen, setTurnOpen] = useState(false);
  const lifeOp = useRef(new Animated.Value(1)).current;
  const turnOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(lifeOp, {
      toValue: turnOpen ? 0 : 1,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(turnOp, {
      toValue: turnOpen ? 1 : 0,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [turnOpen, lifeOp, turnOp]);

  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const toastKey = useRef(0);
  const showToast = useCallback((text: string) => {
    toastKey.current += 1;
    setToast({ key: toastKey.current, text });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  // Settle onto today whenever the position isn't being explored.
  useEffect(() => {
    if (clampedCurrent == null) return;
    if (!wandering && swingRaf.current == null) setDisplayAge(clampedCurrent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedCurrent]);

  // ── Choreography ──────────────────────────────────────────
  const [introT, setIntroT] = useState<number | null>(null);
  const introRaf = useRef<number | null>(null);
  const introDoneRef = useRef(false);

  const finishIntro = useCallback(() => {
    if (introRaf.current != null) cancelAnimationFrame(introRaf.current);
    introRaf.current = null;
    setIntroT(null);
    if (!introDoneRef.current) {
      introDoneRef.current = true;
      setIntroPlayed(true);
      AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    }
  }, []);

  const hasBirth = clampedCurrent != null;
  useEffect(() => {
    if (introPlayed !== false || !hasBirth) return;
    const start = nowMs();
    const tick = () => {
      const t = nowMs() - start;
      if (t >= INTRO_TOTAL) {
        finishIntro();
        return;
      }
      setIntroT(t);
      introRaf.current = requestAnimationFrame(tick);
    };
    setIntroT(0);
    introRaf.current = requestAnimationFrame(tick);
    return () => {
      if (introRaf.current != null) cancelAnimationFrame(introRaf.current);
    };
  }, [introPlayed, hasBirth, finishIntro]);

  // ── Derived visuals ───────────────────────────────────────
  const r = resolve(displayAge);
  const introRunning = introT != null;

  const visual: OriginMapVisual = useMemo(() => {
    if (introRunning && clampedCurrent != null) return introVisual(introT as number, clampedCurrent);
    const so = { north: 0, east: 0, south: 0, west: 0 } as Record<Quarter, number>;
    QUARTERS.forEach((q) => {
      so[q] = wanderFade * (q === r.quarter ? 0.85 : 0.4);
    });
    return {
      blackout: 0,
      still: 1,
      lived: 1,
      future: 1,
      needle: 1,
      nowOn: 1,
      stationOpacity: so,
      yearsOpacity: 0.5 * wanderFade,
      arcsDim,
    };
  }, [introRunning, introT, clampedCurrent, wanderFade, r.quarter, arcsDim]);

  const ui = introRunning ? introUi(introT as number) : UI_SETTLED;

  // ── Zone geometry (px ↔ viewBox) ──────────────────────────
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const mapScale = zone.w > 0 ? Math.min(zone.w / MAP_W, zone.h / MAP_H) : 1;
  const mapOffX = (zone.w - MAP_W * mapScale) / 2;
  const mapOffY = (zone.h - MAP_H * mapScale) / 2;

  // ── §3 pinch-zoom + pan (life spiral only, 1×–2.5×) ───────
  const [zoomState, setZoomState] = useState<ZoomState>(ZOOM_HOME);
  const zoomRef = useRef<ZoomState>(ZOOM_HOME);
  const setZoomBoth = useCallback((z: ZoomState) => {
    zoomRef.current = z;
    setZoomState(z);
  }, []);
  const zoomRaf = useRef<number | null>(null);
  const animateZoomTo = useCallback(
    (target: ZoomState) => {
      if (zoomRaf.current != null) cancelAnimationFrame(zoomRaf.current);
      const from = { ...zoomRef.current };
      const start = nowMs();
      const step = () => {
        const k = easeInOutQuad(clamp01((nowMs() - start) / 240));
        setZoomBoth({
          s: from.s + (target.s - from.s) * k,
          tx: from.tx + (target.tx - from.tx) * k,
          ty: from.ty + (target.ty - from.ty) * k,
        });
        if (k < 1) zoomRaf.current = requestAnimationFrame(step);
        else zoomRaf.current = null;
      };
      zoomRaf.current = requestAnimationFrame(step);
    },
    [setZoomBoth]
  );
  useEffect(
    () => () => {
      if (zoomRaf.current != null) cancelAnimationFrame(zoomRaf.current);
    },
    []
  );

  // Gesture-space → viewBox, through the inverse of the zoom transform
  // (scale about the zone center, then translate).
  const toViewBox = useCallback(
    (x: number, y: number) => {
      const z = zoomRef.current;
      const cx = zone.w / 2;
      const cy = zone.h / 2;
      const ix = cx + (x - z.tx - cx) / z.s;
      const iy = cy + (y - z.ty - cy) / z.s;
      return { x: (ix - mapOffX) / mapScale, y: (iy - mapOffY) / mapScale };
    },
    [mapOffX, mapOffY, mapScale, zone.w, zone.h]
  );

  // ── Actions ───────────────────────────────────────────────
  const swingHome = useCallback(() => {
    if (clampedCurrent == null) return;
    swingTo(clampedCurrent, () => setWandering(false));
  }, [clampedCurrent, swingTo]);

  const openReading = useCallback(() => {
    if (clampedCurrent == null) return;
    setSheet("reading");
    if (hintDone === false) {
      setHintDone(true);
      AsyncStorage.setItem(HINT_KEY, "1").catch(() => {});
    }
  }, [clampedCurrent, hintDone]);

  const goThreshold = useCallback(() => {
    router.navigate("/(tabs)");
  }, []);

  const visitPastDay = useCallback((d: number) => {
    setVisitDay(d);
    router.navigate("/(tabs)");
  }, []);

  const sheetSwingTo = useCallback(
    (age: number) => {
      setSheet(null);
      setWandering(true);
      swingTo(Math.max(0.2, Math.min(age, MAX_AGE - 0.2)));
    },
    [swingTo]
  );

  // ── Gestures (stable; live values via ref) ────────────────
  const stateRef = useRef({
    introRunning,
    turnOpen,
    sheet,
    wandering,
    clampedCurrent,
    wheelDay,
    ctaState,
    encounterReady: !!encounter,
    zoneW: zone.w,
    zoneH: zone.h,
  });
  stateRef.current = {
    introRunning,
    turnOpen,
    sheet,
    wandering,
    clampedCurrent,
    wheelDay,
    ctaState,
    encounterReady: !!encounter,
    zoneW: zone.w,
    zoneH: zone.h,
  };

  const actionsRef = useRef({
    toViewBox,
    openReading,
    swingHome,
    finishIntro,
    goThreshold,
    visitPastDay,
    showToast,
    swingTo,
    setWandering,
    setDisplayAge,
    setZoomBoth,
    animateZoomTo,
  });
  actionsRef.current = {
    toViewBox,
    openReading,
    swingHome,
    finishIntro,
    goThreshold,
    visitPastDay,
    showToast,
    swingTo,
    setWandering,
    setDisplayAge,
    setZoomBoth,
    animateZoomTo,
  };

  const dragRef = useRef({
    startY: 0,
    startT: 0,
    preAge: 0.2,
    lastDetent: null as number | null,
    wandered: false,
  });

  const pinchStart = useRef({ s0: 1, tx0: 0, ty0: 0, fx0: 0, fy0: 0 });

  const gesture = useMemo(() => {
    // §3 — bounded magnification with a rubber band; focal-anchored, so
    // moving both fingers pans the zoomed map. Double-tap resets.
    const soften = (v: number, lo: number, hi: number) =>
      v < lo ? lo - (lo - v) * 0.35 : v > hi ? hi + (v - hi) * 0.35 : v;

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart((e) => {
        const z = zoomRef.current;
        pinchStart.current = { s0: z.s, tx0: z.tx, ty0: z.ty, fx0: e.focalX, fy0: e.focalY };
      })
      .onUpdate((e) => {
        const st = stateRef.current;
        const act = actionsRef.current;
        if (st.introRunning || st.turnOpen || st.sheet) return;
        const P = pinchStart.current;
        const cx = st.zoneW / 2;
        const cy = st.zoneH / 2;
        let s = soften(P.s0 * e.scale, ZOOM_MIN, ZOOM_MAX);
        s = Math.max(0.85, Math.min(s, 3));
        // The map point under the first focal stays under the moving focal.
        const qx = cx + (P.fx0 - P.tx0 - cx) / P.s0;
        const qy = cy + (P.fy0 - P.ty0 - cy) / P.s0;
        act.setZoomBoth({
          s,
          tx: e.focalX - cx - (qx - cx) * s,
          ty: e.focalY - cy - (qy - cy) * s,
        });
      })
      .onEnd(() => {
        const st = stateRef.current;
        const act = actionsRef.current;
        const z = zoomRef.current;
        let s = Math.max(ZOOM_MIN, Math.min(z.s, ZOOM_MAX));
        let tx = z.tx;
        let ty = z.ty;
        if (s <= 1.001) {
          act.animateZoomTo(ZOOM_HOME);
          return;
        }
        const maxTx = ((s - 1) * st.zoneW) / 2;
        const maxTy = ((s - 1) * st.zoneH) / 2;
        tx = Math.max(-maxTx, Math.min(tx, maxTx));
        ty = Math.max(-maxTy, Math.min(ty, maxTy));
        act.animateZoomTo({ s, tx, ty });
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(250)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (!success) return;
        const st = stateRef.current;
        if (st.introRunning || st.turnOpen || st.sheet) return;
        if (zoomRef.current.s > 1.001) actionsRef.current.animateZoomTo(ZOOM_HOME);
      });

    const pan = Gesture.Pan()
      .minDistance(8)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin((e) => {
        dragRef.current = {
          startY: e.y,
          startT: Date.now(),
          preAge: displayAgeRef.current,
          lastDetent: null,
          wandered: false,
        };
      })
      .onUpdate((e) => {
        const st = stateRef.current;
        const act = actionsRef.current;
        if (st.introRunning || st.turnOpen || st.sheet || st.clampedCurrent == null) return;
        const vb = act.toViewBox(e.x, e.y);
        dragRef.current.wandered = true;
        if (!st.wandering) act.setWandering(true);
        let a = ageFromPointer(vb.x, vb.y);
        const n7 = Math.round(a / 7) * 7;
        if (n7 >= 7 && n7 <= MAX_AGE - 7 && Math.abs(a - n7) < 0.55) {
          a = n7 + (a - n7) * 0.25;
          if (dragRef.current.lastDetent !== n7) {
            dragRef.current.lastDetent = n7;
            Haptics.selectionAsync().catch(() => {});
          }
        } else {
          dragRef.current.lastDetent = null;
        }
        act.setDisplayAge(a);
      })
      .onEnd((e) => {
        const st = stateRef.current;
        const act = actionsRef.current;
        if (st.introRunning || st.turnOpen || st.sheet || st.clampedCurrent == null) return;
        const dur = Date.now() - dragRef.current.startT;
        // Swipe up from the lower map region → the reading sheet.
        if (
          dur < 350 &&
          e.translationY < -50 &&
          Math.abs(e.translationX) < 40 &&
          dragRef.current.startY > st.zoneH * 0.68
        ) {
          act.setDisplayAge(dragRef.current.preAge);
          if (Math.abs(dragRef.current.preAge - st.clampedCurrent) < 0.05)
            act.setWandering(false);
          act.openReading();
          return;
        }
        if (!dragRef.current.wandered) return;
        let a = displayAgeRef.current;
        const n7 = Math.round(a / 7) * 7;
        if (n7 >= 7 && n7 <= MAX_AGE - 7 && Math.abs(a - n7) < 0.55) {
          a = n7;
          act.setDisplayAge(a);
        }
        // Close to home → the needle swings back on its own.
        if (Math.abs(a - st.clampedCurrent) < 0.4) act.swingHome();
      });

    const tap = Gesture.Tap()
      .maxDuration(350)
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        const st = stateRef.current;
        const act = actionsRef.current;
        if (st.introRunning) {
          act.finishIntro();
          return;
        }
        if (st.sheet) return; // the backdrop closes sheets
        const vb = act.toViewBox(e.x, e.y);
        if (st.turnOpen) {
          const d = wheelDayFromPoint(vb.x, vb.y);
          if (d == null) return;
          if (d === st.wheelDay) {
            if (st.ctaState !== "complete" && st.encounterReady) act.goThreshold();
            return;
          }
          if (d < st.wheelDay) {
            act.visitPastDay(d);
            return;
          }
          act.showToast("still to come.");
          return;
        }
        if (st.clampedCurrent == null) return;
        // A dated dot? The needle swings to it — crossings AND the
        // counterweight dot alike (§C.1 1a). Nearest one wins.
        let bestAge: number | null = null;
        let bestDist = 14;
        const consider = (a: number) => {
          const p = pt(a);
          const d = Math.hypot(p.x - vb.x, p.y - vb.y);
          if (d < bestDist) {
            bestDist = d;
            bestAge = a;
          }
        };
        for (let a = 7; a < MAX_AGE; a += 7) consider(a);
        const cwAge = displayAgeRef.current - 14;
        if (cwAge >= 0.2) consider(cwAge);
        if (bestAge != null) {
          act.setWandering(true);
          act.swingTo(bestAge);
          return;
        }
        act.openReading();
      });

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, doubleTap, tap));
  }, []);

  // ── NOW halo pulse ────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Content strings ───────────────────────────────────────
  const yearWordOf = (res: ReturnType<typeof resolve>) =>
    word(Math.max(1, Math.floor(res.yot)));

  const epigraphText = encounter
    ? (encounter.mapEpigraph ?? encounter.subtitle)
    : library
      ? "you are here."
      : "";

  const nowP = pt(displayAge);
  const haloLeft = mapOffX + nowP.x * mapScale;
  const haloTop = mapOffY + nowP.y * mapScale;

  const ctaLabel =
    ctaState === "continue" ? "CONTINUE" : ctaState === "complete" ? "COMPLETE · TOMORROW" : "TODAY";

  return (
    <View style={styles.ground}>
      <OriginAtmosphere />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: tabBarHeight + 10 },
        ]}
      >
        {/* HUD */}
        <View style={[styles.hud, { opacity: ui.hud }]}>
          <View style={styles.hudLeft}>
            {hasBirth ? (
              turnOpen ? (
                <>
                  <Text style={styles.hudStation}>{PHASE_DISPLAY[phaseOfDay(wheelDay)]}</Text>
                  <Text style={styles.hudStructure}>TURN {word(practiceTurn).toUpperCase()}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.hudStation}>{r.station.name}</Text>
                  <Text style={styles.hudStructure}>{r.station.structure}</Text>
                </>
              )
            ) : null}
          </View>

          <View style={styles.hudRight}>
            {hasBirth && !turnOpen && (
              <>
                <View style={{ opacity: 1 - wanderFade }}>
                  <Text style={styles.hudCycle}>turn {word(r.turn)}</Text>
                  <Text style={styles.hudCycle}>year {yearWordOf(r)}</Text>
                </View>
                <Pressable
                  onPress={swingHome}
                  style={[
                    styles.todayChip,
                    { opacity: wanderFade, pointerEvents: wandering ? "auto" : "none" },
                  ]}
                  hitSlop={6}
                  testID="today-chip"
                >
                  <Text style={styles.todayChipText} numberOfLines={1}>
                    TODAY
                  </Text>
                </Pressable>
              </>
            )}
            {turnOpen && (
              <Text style={styles.hudCycle}>day {word(wheelDay)}</Text>
            )}
          </View>
        </View>

        {/* Epigraph — the negative space above the map (§6) */}
        <View style={styles.epigraphZone}>
          <Animated.View style={{ opacity: lifeOp }}>
            {hasBirth ? (
              epigraphText ? (
                <Text
                  style={[styles.epigraph, { opacity: ui.epi * (1 - wanderFade) }]}
                  numberOfLines={2}
                >
                  {epigraphText}
                </Text>
              ) : null
            ) : (
              <LinkWhisper
                // Slice 5 — one birth-date form in the whole app: the
                // onboarding signature screen, reached with from=origin.
                label="add your birth date to see your spiral →"
                onPress={() =>
                  router.push({ pathname: "/onboarding/signature", params: { from: "origin" } })
                }
                style={{ alignSelf: "flex-end" }}
                testID="add-birthdate-link"
              />
            )}
          </Animated.View>
        </View>

        {/* Spiral zone */}
        <GestureDetector gesture={gesture}>
          <View
            style={styles.spiralZone}
            onLayout={(e) =>
              setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
            }
            testID="spiral-zone"
          >
            {zone.w > 0 && (
              <>
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: lifeOp,
                      pointerEvents: "none",
                      transform: [
                        { translateX: zoomState.tx },
                        { translateY: zoomState.ty },
                        { scale: zoomState.s },
                      ],
                    },
                  ]}
                >
                  <OriginMap
                    currentAge={clampedCurrent}
                    displayAge={displayAge}
                    birthYear={birthDate ? birthDate.getFullYear() : null}
                    visual={visual}
                    width={zone.w}
                    height={zone.h}
                    screenInsetX={26}
                  />
                  {/* NOW halo — breathes in the approached station's color */}
                  {hasBirth && visual.nowOn > 0.01 && (
                    <View
                      style={{
                        position: "absolute",
                        left: haloLeft - 11,
                        top: haloTop - 11,
                        opacity: visual.nowOn * visual.arcsDim,
                        pointerEvents: "none",
                      }}
                    >
                      <Animated.View
                        style={[
                          styles.halo,
                          {
                            borderColor: STATION[r.quarter].color,
                            opacity: pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 0.75],
                            }),
                            transform: [
                              {
                                scale: pulse.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.72, 1.05],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    </View>
                  )}
                </Animated.View>

                <Animated.View
                  style={[StyleSheet.absoluteFill, { opacity: turnOp, pointerEvents: "none" }]}
                >
                  <TurnWheel
                    today={wheelDay}
                    visited={visitedDays}
                    width={zone.w}
                    height={zone.h}
                  />
                </Animated.View>
              </>
            )}
          </View>
        </GestureDetector>

        {/* Zoom chip */}
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => {
              setSheet(null);
              if (wandering) {
                setWandering(false);
                if (clampedCurrent != null) setDisplayAge(clampedCurrent);
              }
              setZoomBoth(ZOOM_HOME); // the practice wheel is never magnified (§3)
              setTurnOpen((o) => !o);
            }}
            style={[styles.chip, { opacity: ui.cta }]}
            testID="zoom-chip"
          >
            <Text style={styles.chipText}>{turnOpen ? "⤢  the life" : "⤢  the practice"}</Text>
          </Pressable>
        </View>

        {/* Word zone — wander caption, or the one-time hint */}
        <Animated.View style={[styles.wordZone, { opacity: lifeOp }]}>
          {hasBirth && (
            <>
              <View
                style={[styles.captionWrap, { opacity: wanderFade, pointerEvents: "none" }]}
              >
                <Text style={styles.captionStation}>{r.station.name}</Text>
                <Text style={styles.captionMeta}>
                  {birthDate ? monthYearLabel(dateAtAge(birthDate, displayAge)) : ""} · age{" "}
                  {displayAge.toFixed(1)} · turn {word(r.turn)} · year {yearWordOf(r)}
                </Text>
              </View>
              {hintDone === false && (
                <View
                  style={[
                    styles.captionWrap,
                    { opacity: ui.hint * (1 - wanderFade), pointerEvents: "none" },
                  ]}
                >
                  <Text style={styles.hint}>touch the map to read the season</Text>
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* CTA — the door to today (§6) */}
        <View style={styles.ctaZone}>
          {encounter && (
            <Cta
              eyebrow={ctaLabel}
              title={encounter.title}
              onPress={goThreshold}
              complete={ctaState === "complete"}
              disabled={introRunning}
              style={{ opacity: ui.cta, maxWidth: 360 }}
              testID="origin-cta"
            />
          )}
        </View>
      </View>

      {/* Sheets */}
      {birthDate && clampedCurrent != null && (
        <>
          <ReadingSheet
            open={sheet === "reading"}
            displayAge={displayAge}
            currentAge={clampedCurrent}
            birthDate={birthDate}
            now={now}
            bottomPad={tabBarHeight}
            onClose={() => setSheet(null)}
            onCompanions={() => setSheet("companions")}
            onSwingTo={sheetSwingTo}
            onKeepWhatComes={() => {
              // §6 — the position read is the displayed position.
              setSheet(null);
              setCwCapture({
                date: dateAtAge(birthDate, displayAge).toISOString().slice(0, 10),
                phase: r.phase,
              });
            }}
          />
          <CompanionsSheet
            open={sheet === "companions"}
            displayAge={displayAge}
            birthDate={birthDate}
            bottomPad={tabBarHeight}
            onClose={() => setSheet(null)}
            onSwingTo={sheetSwingTo}
          />
        </>
      )}

      {/* §6 — counterweight capture: the standard sheet, type fixed to
          reflection, mapRef carrying the position that provoked it. */}
      <CaptureSheet
        open={cwCapture != null}
        onClose={() => setCwCapture(null)}
        uid={user?.uid ?? null}
        source="spontaneous"
        atmosphere={cwCapture?.phase ?? r.phase}
        bottomPad={tabBarHeight}
        lockedType="reflection"
        mapRef={cwCapture}
        onSaved={() => showToast("kept.")}
      />

      <QuietToast toast={toast} bottom={tabBarHeight + 130} onDone={clearToast} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: "#0a0812",
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
  },

  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    minHeight: 46,
  },
  hudLeft: {},
  hudStation: {
    ...TypeScale.serifTitle,
    color: "rgba(240,235,255,0.92)",
  },
  hudStructure: {
    ...TypeScale.label,
    letterSpacing: 3,
    color: "rgba(200,190,225,0.5)",
    marginTop: 3,
  },
  hudRight: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  hudCycle: {
    ...TypeScale.label,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.58)",
    textAlign: "right",
    lineHeight: 16,
  },
  todayChip: {
    position: "absolute",
    right: 0,
    top: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 13,
    minWidth: 96,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  todayChipText: {
    ...TypeScale.metadata,
    letterSpacing: 2.4,
    color: "rgba(235,228,255,0.85)",
  },

  epigraphZone: {
    minHeight: 46,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginTop: 4,
  },
  epigraph: {
    ...TypeScale.serifSmall,
    lineHeight: 22,
    color: "rgba(235,228,255,0.72)",
    textAlign: "right",
    maxWidth: 250,
  },

  spiralZone: {
    flex: 1,
    marginHorizontal: -26, // let the map breathe to the screen edges
    // Slice 2.1 — the wander caption below owns its bounds: no map element
    // (zoomed or not) may spill out of the spiral zone into it.
    overflow: "hidden",
  },

  halo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },

  chipRow: {
    alignItems: "flex-end",
    marginTop: -2,
    marginBottom: 4,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipText: {
    ...TypeScale.metadata,
    letterSpacing: 1.5,
    color: "rgba(200,190,225,0.58)",
  },

  wordZone: {
    height: 46,
    justifyContent: "center",
  },
  captionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  captionStation: {
    ...TypeScale.serifBody,
    color: "rgba(240,235,255,0.9)",
  },
  captionMeta: {
    ...TypeScale.metadata,
    letterSpacing: 1.6,
    textTransform: "lowercase",
    color: "rgba(200,190,225,0.5)",
    marginTop: 4,
  },
  hint: {
    ...TypeScale.metadata,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.5)",
  },

  ctaZone: {
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
});
