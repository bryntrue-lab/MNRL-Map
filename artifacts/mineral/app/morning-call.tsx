/**
 * The morning call — Slice 6 permission moment + time chooser.
 *
 * Reached once after the first encounter close (after the account moment if
 * both trigger), and permanently from Settings ("the morning call · set a
 * time" — there is NO re-prompt path besides that row).
 *
 * Copy per the Slice 6 copy spec — every string verbatim; the headline is
 * serif (the practice speaking), everything else sans; no serif inside any
 * pressable.
 */
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkPrimary, LinkSecondary } from "@/components/Links";
import { TypeScale } from "@/constants/typography";
import { useUser } from "@/context/UserContext";
import {
  markMorningCallOffered,
  rescheduleMorningCall,
  setMorningCall,
} from "@/lib/notifications";

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12]; // morning wheel; 8:00 default
const ITEM_H = 44;
const DEFAULT_INDEX = HOURS.indexOf(8);

export default function MorningCallScreen() {
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === "settings";
  const { profile } = useUser();

  const [mode, setMode] = useState<"hour" | "sunrise">("hour");
  const [hour, setHour] = useState(8);
  const [busy, setBusy] = useState(false);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const wheelRef = useRef<ScrollView>(null);

  useEffect(() => {
    // The offer fires once, whatever is chosen (§ acceptance: no re-prompt).
    if (!fromSettings) markMorningCallOffered();
  }, [fromSettings]);

  const leave = () => {
    if (fromSettings && router.canGoBack()) router.back();
    else router.replace("/(tabs)/origin");
  };

  // §5: coarse location asked at the moment "at sunrise" is chosen — never
  // before. Declined → revert to the hour wheel without comment.
  const chooseSunrise = async () => {
    if (Platform.OS === "web") return;
    try {
      const Location = await import("expo-location");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setMode("hour");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      coordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setMode("sunrise");
    } catch {
      setMode("hour"); // silent revert — no error line, no explanation
    }
  };

  const onWheelEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const h = HOURS[Math.min(HOURS.length - 1, Math.max(0, i))];
    setHour(h);
    setMode("hour");
  };

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS !== "web") {
        const Notifications = await import("expo-notifications");
        await Notifications.requestPermissionsAsync();
        // Denied → total silence: the setting is kept, the queue stays
        // empty (reschedule checks the OS permission itself). No nagging.
      }
      const coords = coordsRef.current;
      await setMorningCall(
        mode === "sunrise" && coords
          ? { mode: "sunrise", lat: coords.lat, lon: coords.lon }
          : { mode: "hour", hour }
      );
      await rescheduleMorningCall(
        profile?.sequenceDay ?? 1,
        profile?.currentTurn ?? 1
      );
    } catch {
      // the map stays quiet; the Settings row remains the path back
    }
    leave();
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48 },
        ]}
      >
        <Text style={styles.headline}>the map can call you each morning.</Text>

        <View style={styles.chooser}>
          <Pressable
            onPress={chooseSunrise}
            style={({ pressed }) => [
              styles.sunriseRow,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            testID="morning-call-sunrise"
          >
            <Text
              style={[styles.sunriseText, mode === "sunrise" && styles.chosen]}
            >
              at sunrise
            </Text>
          </Pressable>

          <View style={[styles.wheelWrap, mode === "sunrise" && { opacity: 0.35 }]}>
            <ScrollView
              ref={wheelRef}
              style={styles.wheel}
              contentContainerStyle={{ paddingVertical: ITEM_H }}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              contentOffset={{ x: 0, y: DEFAULT_INDEX * ITEM_H }}
              onMomentumScrollEnd={onWheelEnd}
              testID="morning-call-wheel"
            >
              {HOURS.map((h) => (
                <View key={h} style={styles.wheelItem}>
                  <Text
                    style={[
                      styles.wheelText,
                      mode === "hour" && h === hour && styles.chosen,
                    ]}
                  >
                    {h}:00
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View pointerEvents="none" style={styles.wheelBandTop} />
            <View pointerEvents="none" style={styles.wheelBandBottom} />
          </View>
        </View>

        <View style={styles.actions}>
          <LinkPrimary
            label="allow"
            onPress={allow}
            disabled={busy}
            style={styles.allow}
            testID="morning-call-allow"
          />
          <LinkSecondary
            label="not now"
            onPress={leave}
            style={styles.notNow}
            testID="morning-call-not-now"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  headline: {
    ...TypeScale.serifLarge,
    color: "rgba(255,255,255,0.92)",
  },
  chooser: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sunriseRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  sunriseText: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.55)",
  },
  wheelWrap: {
    height: ITEM_H * 3,
    width: 140,
  },
  wheel: {
    flex: 1,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    ...TypeScale.body,
    fontSize: 17,
    lineHeight: 22,
    color: "rgba(255,255,255,0.45)",
  },
  chosen: {
    color: "rgba(255,255,255,0.95)",
  },
  wheelBandTop: {
    position: "absolute",
    top: ITEM_H - 1,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  wheelBandBottom: {
    position: "absolute",
    top: ITEM_H * 2,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  actions: {
    alignItems: "center",
    gap: 18,
  },
  allow: {
    paddingVertical: 4,
  },
  notNow: {
    alignSelf: "center",
  },
});
