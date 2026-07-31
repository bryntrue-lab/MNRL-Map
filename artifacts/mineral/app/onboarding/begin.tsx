import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Timestamp, doc, setDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import BeginButton from "@/components/BeginButton";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { setEncounterSession } from "@/lib/encounter";
import { db } from "@/lib/firebase";
import {
  beginSequenceEncounter,
  fetchEncounterLibrary,
  resolveAudioUrl,
  selectEncounterForDay,
  type EncounterWithId,
} from "@/lib/firestore";
import {
  clearPendingBirthData,
  getPendingBirthData,
} from "@/hooks/useOnboarding";
import type { UserEncounterDoc } from "@/types/firestore";

const { height } = Dimensions.get("window");

const THRESHOLD_TURN = 1;
const SAVED_ENCOUNTER_ID = "the-threshold_t1";
// Kept in step with app/index.tsx — marks the onboarding sequence complete.
const ONBOARDING_DONE_KEY = "mineral_onboarding_done";

export default function BeginScreen() {
  const { user } = useAuth();
  const { updateProfile } = useUser();

  const busy = useRef(false);
  const [library, setLibrary] = useState<EncounterWithId[] | null>(null);

  useEffect(() => {
    let on = true;
    fetchEncounterLibrary()
      .then((l) => on && setLibrary(l))
      .catch((err) => console.warn("onboarding encounter library", err));
    return () => {
      on = false;
    };
  }, []);

  // Commit any birth data the signature collected, once, before leaving
  // onboarding. birthLocation is captured as a typed label (lat/lng feed
  // Human Design later, which is out of scope here).
  const commitBirthData = async () => {
    const data = await getPendingBirthData();
    if (!data) return;
    try {
      const birth = data.birthDate ? new Date(data.birthDate) : null;
      const valid = birth && !Number.isNaN(birth.getTime());
      await updateProfile({
        ...(valid ? { birthDate: Timestamp.fromDate(birth as Date) } : {}),
        ...(data.birthTime ? { birthTime: data.birthTime } : {}),
        ...(data.birthLocation
          ? { birthLocation: { lat: 0, lng: 0, label: data.birthLocation } }
          : {}),
      });
    } catch (err) {
      console.warn("birth data not kept", err);
    }
    await clearPendingBirthData();
  };

  const finishOnboarding = () =>
    AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1").catch(() => {});

  const begin = async () => {
    if (busy.current || !user) return;
    busy.current = true;
    await finishOnboarding();
    await commitBirthData();

    // Enter the encounter flow with the same session shape the Origin CTA
    // uses: select day one (The Threshold), open the instance, resolve audio.
    const encounter = library
      ? selectEncounterForDay(library, 1, THRESHOLD_TURN)
      : null;
    if (!encounter) {
      // Library not ready or missing — land on the map; today's CTA offers it.
      router.replace("/(tabs)/origin");
      return;
    }
    try {
      const url = await resolveAudioUrl(encounter.audioPath);
      const existing = await beginSequenceEncounter(
        user.uid,
        encounter.id,
        THRESHOLD_TURN
      );
      const mode = existing?.status === "completed" ? "visit" : "sequence";
      setEncounterSession({
        encounter,
        turn: THRESHOLD_TURN,
        mode,
        audioUrl: url,
        resume: null,
      });
      router.replace("/encounter");
    } catch (err) {
      console.warn("onboarding begin failed", err);
      router.replace("/(tabs)/origin");
    }
  };

  const saveForLater = async () => {
    if (busy.current || !user) return;
    busy.current = true;
    await finishOnboarding();
    await commitBirthData();

    // userEncounters/the-threshold_t1 as 'saved' — fire-and-forget (offline-safe).
    const data: UserEncounterDoc = {
      encounterId: "the-threshold",
      turn: THRESHOLD_TURN,
      status: "saved",
      startedAt: null,
      completedAt: null,
      visitedAt: null,
      audioPosition: 0,
      blockIndex: 0,
    };
    setDoc(
      doc(db, "users", user.uid, "userEncounters", SAVED_ENCOUNTER_ID),
      data,
      { merge: true }
    ).catch((err) => console.warn("save for later failed", err));

    router.replace("/(tabs)/origin");
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR FIRST ENCOUNTER</Text>
        <Text style={styles.title}>The Threshold</Text>
        <Text style={styles.subtitle}>
          something is calling — what comes when you stop naming it?
        </Text>

        <BeginButton onPress={begin} meta="3 MIN" />

        <Pressable
          style={({ pressed }) => [styles.saveWrap, { opacity: pressed ? 0.5 : 1 }]}
          onPress={saveForLater}
          hitSlop={12}
          testID="save-for-later"
        >
          <Text style={styles.saveText}>save for later</Text>
        </Pressable>
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
    paddingTop: height * 0.1,
    paddingBottom: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: FontFamily.sans600,
    fontSize: 10,
    letterSpacing: 2.5,
    color: "rgba(196,74,138,0.85)",
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 30,
    letterSpacing: -0.4,
    color: "rgba(255,255,255,0.98)",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 48,
  },
  saveWrap: {
    marginTop: 24,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  saveText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
  },
});
