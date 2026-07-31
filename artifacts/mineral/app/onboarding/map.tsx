import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import OnboardingFooter from "@/components/OnboardingFooter";
import {
  OriginMap,
  SETTLED_VISUAL,
  type OriginMapVisual,
} from "@/components/SpiralComponents";
import { FontFamily } from "@/constants/typography";
import { getPendingBirthData } from "@/hooks/useOnboarding";
import { MAX_AGE, QUARTERS, ageAt, type Quarter } from "@/lib/spiral";

const { width, height } = Dimensions.get("window");

const MAP_SIZE = Math.min(width - 48, 340);

const nowMs = () =>
  typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutCubic = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeInOutQuad = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// A compact draw — the payoff, not the full Origin choreography (which plays
// again on the Origin tab). Still point → lived line outside-in → needle → NOW.
const T0 = 400;
const DRAW = 3600;
const TOTAL = T0 + DRAW + 1600;

function drawVisual(t: number, currentAge: number): OriginMapVisual {
  const base = T0 + DRAW;
  const lived = easeInOutCubic(clamp01((t - T0) / DRAW));
  const drawnAge = lived * currentAge;

  const stationOpacity = { north: 0, east: 0, south: 0, west: 0 } as Record<Quarter, number>;
  const revealAge: Record<Quarter, number> = { north: 0, east: 7, south: 14, west: 21 };
  QUARTERS.forEach((q) => {
    const reveal = revealAge[q];
    const on =
      q === "north"
        ? t >= T0
          ? 1
          : 0
        : currentAge >= reveal
          ? clamp01((drawnAge - reveal) / 2)
          : 0;
    stationOpacity[q] = 0.5 * on;
  });

  return {
    blackout: 1 - clamp01((t - 100) / 1000),
    still: clamp01((t - 200) / 900),
    lived,
    future: clamp01((t - (base + 100)) / 700),
    needle: easeInOutQuad(clamp01((t - (base + 300)) / 900)),
    nowOn: clamp01((t - (base + 900)) / 600),
    stationOpacity,
    yearsOpacity: 0,
    arcsDim: 1,
  };
}

/**
 * The map draws itself (Task C §4 / C.1 §4) — the payoff of the signature.
 * If a birth date was given, a compact draw of the life spiral plays here;
 * the full first-run choreography plays once more on the Origin tab. If the
 * signature was skipped, a still-point-only moment: "you are here."
 */
export default function MapDrawsScreen() {
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let on = true;
    getPendingBirthData()
      .then((data) => {
        if (!on) return;
        const iso = data?.birthDate;
        const birth = iso ? new Date(iso) : null;
        const valid = birth && !Number.isNaN(birth.getTime());
        setCurrentAge(valid ? ageAt(birth as Date, new Date()) : null);
        setResolved(true);
      })
      .catch(() => on && setResolved(true));
    return () => {
      on = false;
    };
  }, []);

  const hasBirth = currentAge != null;
  const clampedAge = hasBirth
    ? Math.max(0.2, Math.min(currentAge as number, MAX_AGE - 0.2))
    : null;

  // Drive the draw once the birth data has resolved and there is a date.
  useEffect(() => {
    if (!resolved || !hasBirth) return;
    const start = nowMs();
    const tick = () => {
      const elapsed = nowMs() - start;
      if (elapsed >= TOTAL) {
        setT(TOTAL);
        return;
      }
      setT(elapsed);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [resolved, hasBirth]);

  const visual: OriginMapVisual = useMemo(() => {
    if (!hasBirth) return SETTLED_VISUAL;
    if (t >= TOTAL) return { ...SETTLED_VISUAL, yearsOpacity: 0 };
    return drawVisual(t, clampedAge as number);
  }, [hasBirth, t, clampedAge]);

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <View style={styles.contentWrap}>
        <View style={styles.mapWrap}>
          {resolved && (
            <OriginMap
              currentAge={clampedAge}
              displayAge={clampedAge ?? 0.2}
              birthYear={null}
              visual={visual}
              width={MAP_SIZE}
              height={MAP_SIZE}
            />
          )}
        </View>

        {!hasBirth && resolved ? (
          <Text style={styles.here}>you are here.</Text>
        ) : null}
      </View>

      <OnboardingFooter onContinue={() => router.push("/onboarding/practice")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  here: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 18,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    marginTop: 28,
  },
});
