import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import BeginButton from "@/components/BeginButton";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkSecondary, LinkWhisper } from "@/components/Links";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { setEncounterSession } from "@/lib/encounter";
import {
  beginSequenceEncounter,
  fetchEncounterLibrary,
  resolveAudioUrl,
  selectEncounterForDay,
} from "@/lib/firestore";
import { TypeScale } from "@/constants/typography";

const { height } = Dimensions.get("window");

/**
 * Slice 5, step 6 — the terminal step. No account wall, ever: auth is
 * anonymous already, and account creation lives only in the keep-this
 * moment and Settings (auth-after-desire).
 *   begin → the Day-1 encounter flow (the same session contract the
 *   Today threshold uses — the encounter's internals are untouched).
 *   save for later → the Origin tab, map present.
 */
export default function BeginScreen() {
  const { user } = useAuth();
  const { updateProfile } = useUser();
  const [notReady, setNotReady] = useState(false);
  const busy = useRef(false);

  const markOnboarded = async () => {
    try {
      await updateProfile({ onboarded: true });
    } catch (err) {
      // Never a dead end: navigation proceeds. Worst case (skipped
      // signature + failed write) the six steps replay on next launch.
      console.warn("onboarded flag not kept", err);
    }
  };

  const begin = async () => {
    if (busy.current || !user) return;
    busy.current = true;
    setNotReady(false);
    try {
      const library = await fetchEncounterLibrary();
      const encounter = selectEncounterForDay(library, 1, 1);
      if (!encounter) throw new Error("no encounter for day 1");
      const url = await resolveAudioUrl(encounter.audioPath);
      await beginSequenceEncounter(user.uid, encounter.id, 1);
      await markOnboarded();
      setEncounterSession({
        encounter,
        turn: 1,
        mode: "sequence",
        audioUrl: url,
        resume: null,
      });
      router.replace("/encounter");
    } catch (err) {
      console.warn("first threshold not ready", err);
      busy.current = false;
      // The soft refusal — never a dead end: the map is always there.
      setNotReady(true);
    }
  };

  const later = async () => {
    if (busy.current) return;
    busy.current = true;
    await markOnboarded();
    // Explicitly the Origin tab — deep-linking "/(tabs)" can resolve to
    // the index (Today) route instead of the declared initial tab.
    router.replace("/(tabs)/origin");
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR FIRST ENCOUNTER</Text>
        <Text style={styles.title}>The Threshold</Text>
        <Text style={styles.subtitle}>
          saying yes to not knowing
        </Text>

        <BeginButton onPress={begin} />

        {notReady ? (
          <LinkWhisper
            label="the threshold isn’t ready — the map is. go there →"
            onPress={later}
            style={styles.notReady}
            textStyle={{ textAlign: "center" }}
          />
        ) : null}

        {/* Save for later — quiet secondary */}
        <LinkSecondary
          label="save for later"
          onPress={later}
          style={styles.saveWrap}
          testID="onboarding-save-later"
        />
      </View>
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
    paddingHorizontal: 36,
    paddingTop: height * 0.10,
    paddingBottom: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "#E08AAF",
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    ...TypeScale.display,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    ...TypeScale.serifSmall,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 48,
  },
  notReady: {
    marginTop: 20,
    alignSelf: "center",
  },
  saveWrap: {
    marginTop: 24,
    alignSelf: "center",
  },
});
