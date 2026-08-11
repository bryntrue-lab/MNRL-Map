import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArchaicAtmosphere,
  MagicalAtmosphere,
  MentalAtmosphere,
  MythicalAtmosphere,
} from "@/components/Atmosphere";
import BeginButton from "@/components/BeginButton";
import { LinkWhisper } from "@/components/Links";
import { SpiralIndicator } from "@/components/SpiralComponents";
import TabTopBar from "@/components/TabTopBar";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  setEncounterSession,
  type EncounterMode,
  type EncounterSession,
} from "@/lib/encounter";
import {
  beginSequenceEncounter,
  fetchEncounterLibrary,
  findCrystallizingNote,
  recordVisit,
  resolveAudioUrl,
  selectEncounterForDay,
  userEncounterId,
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
    if (!encounter || busy.current || !user) return;
    busy.current = true;
    try {
      // Resolve the Storage URL first — a missing file surfaces here and
      // ends in the quiet return, never inside the held space (§11, §4).
      const url = await resolveAudioUrl(encounter.audioPath);

      let mode: EncounterMode = visiting ? "visit" : "sequence";
      let resume: EncounterSession["resume"] = null;

      if (!visiting) {
        const existing = await beginSequenceEncounter(
          user.uid,
          encounter.id,
          practiceTurn
        );
        if (existing?.status === "completed") {
          // Today's door already closed this turn — entering again is a
          // visit: full flow, no completion writes (§2).
          mode = "visit";
        } else if (existing?.status === "in-progress") {
          // Only a genuine mid-flow doc resumes; a visited→in-progress
          // upgrade starts fresh (its old positions belong to the visit).
          const blockIndex = existing.blockIndex ?? 0;
          const audioPosition = existing.audioPosition ?? 0;
          let crystallizing: { content: string | null } | null = null;
          if (blockIndex === 0) {
            // Capture already kept but no block reached → resume lands on
            // the counterweight, not a second ⟡ (§4 resume rules).
            const note = await findCrystallizingNote(
              user.uid,
              userEncounterId(encounter.id, practiceTurn)
            );
            if (note) crystallizing = { content: note.content ?? null };
          }
          if (blockIndex > 0 || audioPosition > 0 || crystallizing) {
            resume = { audioPosition, blockIndex, crystallizing };
          }
        }
      }

      setEncounterSession({
        encounter,
        turn: practiceTurn,
        mode,
        audioUrl: url,
        resume,
      });
      busy.current = false;
      router.push("/encounter");
    } catch (err) {
      console.warn("threshold begin failed", err);
      // Offline or missing audio — the soft refusal (§4). showNotReady's
      // timer releases the busy latch when the moment passes.
      showNotReady();
    }
  };

  const phase: PhaseId = encounter?.phase ?? "signal";
  const Atmosphere = ATMOSPHERE[phase];
  const accent = PHASE_ACCENT[phase];
  const eyebrow = visiting
    ? `VISITING · ENCOUNTER ${word(dayInTurn(day)).toUpperCase()}`
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
        <TabTopBar title="TODAY" rightIcon="⊙" onRightPress={() => router.push("/settings")} />

        <View style={styles.spiralWrap}>
          <SpiralIndicator phase={phase} turn={turnWord} size={200} />
        </View>

        {encounter ? (
          <View style={styles.encounterCard}>
            <Text style={[styles.encounterEyebrow, { color: `${accent}D9` }]}>{eyebrow}</Text>
            <Text style={styles.encounterTitle}>{encounter.title}</Text>
            <Text style={styles.encounterSubtitle}>{encounter.subtitle}</Text>

            <BeginButton onPress={begin} meta="3 min · voice" accent={accent} />

            {notReady && (
              <Animated.Text style={[styles.notReady, { opacity: notReadyOpacity }]}>
                This encounter isn't ready yet.
              </Animated.Text>
            )}
          </View>
        ) : missing ? (
          <View style={styles.encounterCard}>
            <Text style={styles.notReadyStatic}>This encounter isn't ready yet.</Text>
            <LinkWhisper
              label="back to the map →"
              onPress={() => router.navigate("/(tabs)/origin")}
              style={styles.returnWrap}
              testID="return-to-map"
            />
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
    ...TypeScale.micro,
    letterSpacing: 2.5,
    textAlign: "center",
    marginBottom: 12,
  },
  encounterTitle: {
    ...TypeScale.serifTitle,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 12,
  },
  encounterSubtitle: {
    ...TypeScale.serifSmall,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 36,
  },

  notReady: {
    marginTop: 22,
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
  },
  notReadyStatic: {
    ...TypeScale.serifSmall,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    marginTop: 24,
  },
  returnWrap: {
    marginTop: 20,
    alignSelf: "center",
  },
});
