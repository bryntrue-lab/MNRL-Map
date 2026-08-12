import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  INTRO_KEY_EXPORT as INTRO_KEY,
  INTRO_TOTAL,
  introVisual,
} from "@/app/(tabs)/origin";
import { LinkPrimary } from "@/components/Links";
import { OriginMap, type OriginMapVisual } from "@/components/SpiralComponents";
import colors from "@/constants/colors";
import { LinkType, TypeScale } from "@/constants/typography";
import { useUser } from "@/context/UserContext";
import {
  MAP_H,
  MAP_W,
  MAX_AGE,
  QUARTERS,
  ageAt,
  ageFromPointer,
  dateAtAge,
  monthYearLabel,
  resolve,
  word,
  type Quarter,
} from "@/lib/spiral";

// ─────────────────────────────────────────────────────────────
// Slice 5, step 4 — the map draws itself. The full Task A §8
// first-run choreography, played on the Origin surface with the
// just-entered birth date. ~12s, any tap skips. If the signature
// was skipped: the still-point variant — "you are here."
//
// Slice I — the choreography ends in an open hand: when the
// needle settles on today, the sequence HOLDS on the live map in
// wander mode. "you are here." + meta fade in above; two seconds
// later a whisper offers the drag; a quiet continue → advances.
// The first drag dismisses the whisper and the caption behaves as
// the normal wander caption from then on. First-run only — the
// Origin tab is untouched.
// ─────────────────────────────────────────────────────────────

const STILL_VISUAL: OriginMapVisual = {
  blackout: 0,
  still: 1,
  lived: 0,
  future: 0,
  needle: 0,
  nowOn: 0,
  stationOpacity: Object.fromEntries(QUARTERS.map((q) => [q, 0])) as Record<Quarter, number>,
  yearsOpacity: 0,
  arcsDim: 1,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutQuad = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** RAF-eased value — same shape as origin's useEasedValue (not exported there). */
function useEasedValue(target: number, duration: number): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;
    const start = Date.now();
    const step = () => {
      const k = clamp01((Date.now() - start) / duration);
      const v = from + (target - from) * easeInOutQuad(k);
      valueRef.current = v;
      setValue(v);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);
  return value;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useUser();

  const birthDate = useMemo(
    () => (profile?.birthDate ? profile.birthDate.toDate() : null),
    [profile?.birthDate]
  );
  const currentAge = useMemo(
    () => (birthDate ? ageAt(birthDate, new Date()) : null),
    [birthDate]
  );
  const hasBirth = currentAge != null;
  const clampedCurrent =
    currentAge != null ? Math.max(0.2, Math.min(currentAge, MAX_AGE - 0.2)) : null;

  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const advancedRef = useRef(false);

  // ── Slice I — the held beat ───────────────────────────────
  const [holding, setHolding] = useState(false);
  const [wandered, setWandered] = useState(false);
  const [whisperOn, setWhisperOn] = useState(false);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    // Played in full (or skipped) with a real birth date → the Origin
    // tab must not replay it. The still-point run leaves the key unset:
    // the true draw is still owed once a birth date exists.
    if (hasBirth) AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    router.push("/onboarding/practice");
  }, [hasBirth]);

  // The draw completes → hold open instead of advancing. The intro key
  // is marked here: the choreography HAS played in full.
  const enterHold = useCallback(() => {
    if (advancedRef.current || raf.current == null) return;
    cancelAnimationFrame(raf.current);
    raf.current = null;
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
    setHolding(true);
  }, []);

  useEffect(() => {
    if (!hasBirth || holding) return;
    const start = Date.now();
    const tick = () => {
      const el = Date.now() - start;
      if (el >= INTRO_TOTAL + 900) {
        enterHold();
        return;
      }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [hasBirth, holding, enterHold]);

  // Whisper — two seconds into the hold, unless the hands moved first.
  useEffect(() => {
    if (!holding || wandered) return;
    const id = setTimeout(() => setWhisperOn(true), 2000);
    return () => clearTimeout(id);
  }, [holding, wandered]);

  // ── Wander state (hold only) — a faithful reduction of the Origin
  // pendulum: displayAge + 900ms swing, wanderFade, 7-year detents.
  const [displayAge, setDisplayAgeState] = useState(0.2);
  const displayAgeRef = useRef(0.2);
  const setDisplayAge = useCallback((v: number) => {
    displayAgeRef.current = v;
    setDisplayAgeState(v);
  }, []);

  useEffect(() => {
    if (holding && clampedCurrent != null) setDisplayAge(clampedCurrent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  const swingRaf = useRef<number | null>(null);
  const swingTo = useCallback(
    (target: number, after?: () => void) => {
      if (swingRaf.current != null) cancelAnimationFrame(swingRaf.current);
      const from = displayAgeRef.current;
      const start = Date.now();
      const step = () => {
        const k = clamp01((Date.now() - start) / 900);
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

  // I1 — the held words FADE in (and the whisper fades in/out), same
  // eased register as the wander fade.
  const captionFade = useEasedValue(holding ? 1 : 0, 700);
  const whisperFade = useEasedValue(whisperOn && !wandered ? 1 : 0, 700);

  // ── Zone geometry (px ↔ viewBox; no zoom here) ────────────
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const mapScale = zone.w > 0 ? Math.min(zone.w / MAP_W, zone.h / MAP_H) : 1;
  const mapOffX = (zone.w - MAP_W * mapScale) / 2;
  const mapOffY = (zone.h - MAP_H * mapScale) / 2;
  const geomRef = useRef({ mapScale, mapOffX, mapOffY });
  geomRef.current = { mapScale, mapOffX, mapOffY };

  const stateRef = useRef({ holding, clampedCurrent, wandering });
  stateRef.current = { holding, clampedCurrent, wandering };
  const dragRef = useRef({ lastDetent: null as number | null, moved: false });

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(8)
        .maxPointers(1)
        .runOnJS(true)
        .onBegin(() => {
          dragRef.current = { lastDetent: null, moved: false };
        })
        .onUpdate((e) => {
          const st = stateRef.current;
          if (!st.holding || st.clampedCurrent == null) return;
          const g = geomRef.current;
          const vx = (e.x - g.mapOffX) / g.mapScale;
          const vy = (e.y - g.mapOffY) / g.mapScale;
          dragRef.current.moved = true;
          setWandered(true);
          setWhisperOn(false);
          if (!st.wandering) setWandering(true);
          let a = ageFromPointer(vx, vy);
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
          setDisplayAge(a);
        })
        .onEnd(() => {
          const st = stateRef.current;
          if (!st.holding || st.clampedCurrent == null || !dragRef.current.moved) return;
          let a = displayAgeRef.current;
          const n7 = Math.round(a / 7) * 7;
          if (n7 >= 7 && n7 <= MAX_AGE - 7 && Math.abs(a - n7) < 0.55) {
            a = n7;
            setDisplayAge(a);
          }
          // Close to home → the needle swings back on its own.
          if (Math.abs(a - st.clampedCurrent) < 0.4)
            swingTo(st.clampedCurrent, () => setWandering(false));
        }),
    [setDisplayAge, swingTo]
  );

  // ── Derived visuals ───────────────────────────────────────
  const r = resolve(displayAge);
  const yearWord = word(Math.max(1, Math.floor(r.yot)));

  const visual: OriginMapVisual = useMemo(() => {
    if (!holding)
      return hasBirth ? introVisual(Math.min(t, INTRO_TOTAL), currentAge as number) : STILL_VISUAL;
    // The Origin wander state, verbatim: one station leads, others recede.
    const so = { north: 0, east: 0, south: 0, west: 0 } as Record<Quarter, number>;
    QUARTERS.forEach((q) => {
      so[q] = wanderFade * (q === r.quarter ? 0.85 : 0.4 * 0.5);
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
      arcsDim: 1,
    };
  }, [holding, hasBirth, t, currentAge, wanderFade, r.quarter]);

  const metaLine = birthDate
    ? `${monthYearLabel(dateAtAge(birthDate, displayAge))} · age ${displayAge.toFixed(1)}`
    : "";

  const mapBody = (
    <View
      style={styles.mapZone}
      onLayout={(e) =>
        setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {zone.w > 0 && (
        <OriginMap
          currentAge={holding ? clampedCurrent : currentAge}
          displayAge={holding ? displayAge : (currentAge ?? 0)}
          birthYear={birthDate ? birthDate.getFullYear() : null}
          visual={visual}
          width={zone.w}
          height={zone.h}
          approachedQuarter={holding && wandering ? r.quarter : null}
        />
      )}
    </View>
  );

  // ── The held beat — live map, open hand ───────────────────
  if (holding) {
    return (
      <View style={styles.container} testID="onboarding-map-hold">
        {/* Caption above the map — "you are here." until the first drag,
            then the normal wander caption (station leads, fades with rest). */}
        <View style={[styles.captionZone, { marginTop: insets.top + 24 }]}>
          {!wandered ? (
            <View style={{ alignItems: "center", opacity: captionFade }}>
              <Text style={styles.hereLine}>you are here.</Text>
              <Text style={styles.captionMeta}>{metaLine}</Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", opacity: wanderFade }}>
              <Text style={styles.captionStation}>{r.station.name}</Text>
              <Text style={styles.captionMeta}>
                {metaLine} · cycle {word(r.turn)} · year {yearWord}
              </Text>
            </View>
          )}
        </View>

        <GestureDetector gesture={pan}>{mapBody}</GestureDetector>

        <View style={[styles.footerZone, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}>
          <Text
            style={[styles.whisper, { opacity: whisperFade }]}
            testID="map-hold-whisper"
          >
            drag anywhere — the map answers →
          </Text>
          <LinkPrimary
            label="continue →"
            onPress={advance}
            style={{ alignSelf: "center" }}
            testID="map-hold-continue"
          />
        </View>
      </View>
    );
  }

  // ── The draw (or the still-point variant) — tap skips, as ever ──
  return (
    <Pressable style={styles.container} onPress={advance} testID="onboarding-map">
      {mapBody}

      {!hasBirth && (
        <View style={[styles.stillWrap, { bottom: insets.bottom + 120 }]}>
          <Text style={styles.stillLine}>you are here.</Text>
        </View>
      )}

      <Text style={[styles.hint, { bottom: Math.max(insets.bottom, 20) + 44 }]}>
        tap to continue
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  mapZone: {
    flex: 1,
    marginVertical: 40,
  },
  stillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  stillLine: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.72)",
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    ...TypeScale.metadata,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
  },

  // ── Slice I — the held beat ───────────────────────────────
  captionZone: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  hereLine: {
    ...TypeScale.serifLarge,
    color: "rgba(240,235,255,0.9)",
  },
  captionStation: {
    ...TypeScale.serifTitle,
    color: "rgba(240,235,255,0.9)",
  },
  captionMeta: {
    ...TypeScale.metadata,
    letterSpacing: 0.4,
    textTransform: "lowercase",
    color: colors.light.textTertiary,
    marginTop: 4,
  },
  footerZone: {
    alignItems: "center",
    gap: 18,
  },
  whisper: {
    ...LinkType.whisper,
    color: "rgba(200,190,225,0.55)",
  },
});
