import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArchaicAtmosphere,
  MagicalAtmosphere,
  MentalAtmosphere,
  MythicalAtmosphere,
} from "@/components/Atmosphere";
import BeginButton from "@/components/BeginButton";
import { SpiralIndicator } from "@/components/SpiralComponents";
import TabTopBar from "@/components/TabTopBar";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  fetchEncounterLibrary,
  recordVisit,
  resolveAudioUrl,
  selectEncounterForDay,
  type EncounterWithId,
} from "@/lib/firestore";
import { PHASE_ACCENT, dayInTurn, practiceTurnOf, word } from "@/lib/spiral";
import { consumeVisitDay } from "@/lib/visitStore";
import type { PhaseId } from "@/types/firestore";

const ATMOSPHERE: Record<PhaseId, React.ComponentType> = {
  signal: ArchaicAtmosphere,
  field: MagicalAtmosphere,
  friction: MythicalAtmosphere,
  voice: MentalAtmosphere,
};

const TURN_WORDS = ["first", "second", "third", "fourth", "fifth"] as const;

/**
 * The Threshold (§11) — the door to today's encounter, or to a visited one.
 * The encounter is selected by the practice clock (sequenceDay); visits
 * arrive from the turn wheel with their day in the visit store.
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUser();

  const [library, setLibrary] = useState<EncounterWithId[] | null>(null);
  const [libraryFailed, setLibraryFailed] = useState(false);
  const [visitDay, setVisitDay] = useState<number | null>(null);
  const [notReady, setNotReady] = useState(false);
  const notReadyOpacity = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  useEffect(() => {
    let on = true;
    fetchEncounterLibrary()
      .then((l) => on && setLibrary(l))
      .catch(() => on && setLibraryFailed(true));
    return () => {
      on = false;
    };
  }, []);

  // A visit is honored once, then framing resets when the screen is left.
  useFocusEffect(
    useCallback(() => {
      const d = consumeVisitDay();
      if (d != null) setVisitDay(d);
      return () => setVisitDay(null);
    }, [])
  );

  const sequenceDay = profile?.sequenceDay ?? 1;
  // Practice turn derives from sequenceDay directly (never from the synced
  // currentTurn field, which may lag by one snapshot on boundary days).
  const practiceTurn = practiceTurnOf(sequenceDay);
  const day = visitDay ?? sequenceDay;
  const visiting = visitDay != null;

  const encounter = library ? selectEncounterForDay(library, day, practiceTurn) : null;

  // §9 — visits record status 'visited' + visitedAt (never downgrading).
  useEffect(() => {
    if (!visiting || !user || !encounter) return;
    recordVisit(user.uid, encounter.id, practiceTurn).catch((err) =>
      console.warn("visit not recorded", err)
    );
  }, [visiting, user, encounter, practiceTurn]);

  // The quiet-return timer must die with the screen — otherwise it can
  // yank the user back to the map after they've already navigated away.
  const notReadyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (notReadyTimer.current != null) clearTimeout(notReadyTimer.current);
    },
    []
  );

  const showNotReady = () => {
    setNotReady(true);
    Animated.timing(notReadyOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    notReadyTimer.current = setTimeout(() => {
      Animated.timing(notReadyOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setNotReady(false);
        busy.current = false;
        // The quiet return — back to the map.
        router.navigate("/(tabs)/origin");
      });
    }, 1900);
  };

  const begin = async () => {
    if (!encounter || busy.current) return;
    busy.current = true;
    try {
      // Resolve the Storage URL now so Milestone B can hand it straight to
      // the player — and so a missing file surfaces here, gracefully.
      await resolveAudioUrl(encounter.audioPath);
    } catch (err) {
      console.warn("audio not resolvable", err);
    }
    // The encounter flow itself is Milestone B — every path ends quietly here.
    showNotReady();
  };

  const phase: PhaseId = encounter?.phase ?? "signal";
  const Atmosphere = ATMOSPHERE[phase];
  const accent = PHASE_ACCENT[phase];
  const eyebrow = visiting
    ? `VISITING · DAY ${word(dayInTurn(day)).toUpperCase()}`
    : "TODAY'S ENCOUNTER";
  const turnWord = TURN_WORDS[practiceTurnOf(sequenceDay) - 1] ?? "first";

  const missing = (library && !encounter) || libraryFailed;

  return (
    <View style={styles.container}>
      <Atmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TabTopBar title="TODAY" />

        <View style={styles.spiralWrap}>
          <SpiralIndicator phase={phase} turn={turnWord} size={200} />
        </View>

        {encounter ? (
          <View style={styles.encounterCard}>
            <Text style={[styles.encounterEyebrow, { color: `${accent}D9` }]}>{eyebrow}</Text>
            <Text style={styles.encounterTitle}>{encounter.title}</Text>
            <Text style={styles.encounterSubtitle}>{encounter.subtitle}</Text>

            <BeginButton onPress={begin} meta="3 min · voice" />

            {notReady && (
              <Animated.Text style={[styles.notReady, { opacity: notReadyOpacity }]}>
                This encounter isn't ready yet.
              </Animated.Text>
            )}
          </View>
        ) : missing ? (
          <View style={styles.encounterCard}>
            <Text style={styles.notReadyStatic}>This encounter isn't ready yet.</Text>
            <Pressable
              onPress={() => router.navigate("/(tabs)/origin")}
              style={styles.returnWrap}
              testID="return-to-map"
            >
              <Text style={styles.returnText}>back to the map →</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  scrollContent: {
    paddingHorizontal: 28,
  },

  spiralWrap: {
    alignItems: "center",
    marginBottom: 36,
  },

  encounterCard: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 48,
  },
  encounterEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    textAlign: "center",
    marginBottom: 12,
  },
  encounterTitle: {
    fontFamily: FontFamily.sans500,
    fontSize: 28,
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 12,
  },
  encounterSubtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 36,
  },

  notReady: {
    marginTop: 22,
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  notReadyStatic: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 24,
  },
  returnWrap: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  returnText: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.5)",
  },
});
