import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";

export const BIRTHDATE_PROMPTED_KEY = "mineral_birthdate_prompted";

/**
 * Entry routing (§4): first launch signs in anonymously, then the single
 * birth-date step, then the tabs. Returning launches go straight to the tabs.
 */
export default function Index() {
  const { user, loading, signInAnon } = useAuth();
  const { profile, loading: profileLoading } = useUser();
  const [authFailed, setAuthFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [prompted, setPrompted] = useState<boolean | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(BIRTHDATE_PROMPTED_KEY)
      .then((v) => setPrompted(v === "1"))
      .catch(() => setPrompted(false));
  }, []);

  // Safety valve: if Firebase auth never resolves (e.g. network offline),
  // surface the quiet retry state instead of waiting forever.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // §4 — anonymous auth on first launch.
  useEffect(() => {
    if (loading || user || attempted.current) return;
    attempted.current = true;
    signInAnon().catch(() => setAuthFailed(true));
  }, [loading, user, signInAnon]);

  const retry = () => {
    setAuthFailed(false);
    setTimedOut(false);
    signInAnon().catch(() => setAuthFailed(true));
  };

  if (!user && (authFailed || timedOut)) {
    return (
      <Pressable style={styles.ground} onPress={retry}>
        <Text style={styles.quiet}>no connection — tap to try again</Text>
      </Pressable>
    );
  }

  if (!user || profileLoading || !profile || prompted === null) {
    // Dark ground while auth and the profile resolve — no white flash.
    return <View style={styles.ground} />;
  }

  if (!profile.birthDate && !prompted) return <Redirect href="/birthdate" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: "#05030a",
    alignItems: "center",
    justifyContent: "center",
  },
  quiet: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.4)",
  },
});
