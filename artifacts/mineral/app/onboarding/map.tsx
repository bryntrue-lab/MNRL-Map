import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  INTRO_KEY_EXPORT as INTRO_KEY,
  INTRO_TOTAL,
  introVisual,
} from "@/app/(tabs)/origin";
import { OriginMap, type OriginMapVisual } from "@/components/SpiralComponents";
import { FontFamily } from "@/constants/typography";
import { useUser } from "@/context/UserContext";
import { QUARTERS, ageAt, type Quarter } from "@/lib/spiral";

// ─────────────────────────────────────────────────────────────
// Slice 5, step 4 — the map draws itself. The full Task A §8
// first-run choreography, played on the Origin surface with the
// just-entered birth date. ~12s, any tap skips. If the signature
// was skipped: the still-point variant — "you are here."
// The choreography itself lives in origin.tsx; this screen only
// plays it. Playing here marks it played, so the Origin tab does
// not replay it — unless the still-point ran, in which case the
// real draw is still owed when a birth date arrives.
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

  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const advancedRef = useRef(false);

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

  useEffect(() => {
    if (!hasBirth) return;
    const start = Date.now();
    const tick = () => {
      const el = Date.now() - start;
      if (el >= INTRO_TOTAL + 900) {
        advance();
        return;
      }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [hasBirth, advance]);

  const visual = hasBirth ? introVisual(Math.min(t, INTRO_TOTAL), currentAge) : STILL_VISUAL;

  const [zone, setZone] = useState({ w: 0, h: 0 });

  return (
    <Pressable style={styles.container} onPress={advance} testID="onboarding-map">
      <View
        style={styles.mapZone}
        onLayout={(e) =>
          setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {zone.w > 0 && (
          <OriginMap
            currentAge={currentAge}
            displayAge={currentAge ?? 0}
            birthYear={birthDate ? birthDate.getFullYear() : null}
            visual={visual}
            width={zone.w}
            height={zone.h}
          />
        )}
      </View>

      {!hasBirth && (
        <View style={[styles.stillWrap, { bottom: insets.bottom + 120 }]}>
          <Text style={styles.stillLine}>you are here.</Text>
        </View>
      )}

      <Text style={[styles.hint, { bottom: Math.max(insets.bottom, 20) + 44 }]}>
        {hasBirth ? "tap to continue" : "tap to continue"}
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
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: FontFamily.sans400,
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.3)",
  },
});
