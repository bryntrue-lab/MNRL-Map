import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";

/**
 * Entry routing (Slice 5, amendment B): app start with no session signs in
 * anonymously. A new/empty user doc (never onboarded, no birth date) →
 * the six-step onboarding; otherwise → the tabs (Origin is the launch tab).
 * There is no state in which a legacy flow or account wall can appear.
 */
export default function Index() {
  const { user, loading, signInAnon } = useAuth();
  const { profile, loading: profileLoading } = useUser();
  const [authFailed, setAuthFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const attempted = useRef(false);

  // Safety valve: if Firebase auth never resolves (e.g. network offline),
  // surface the quiet retry state instead of waiting forever.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Anonymous auth on first launch — as always.
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

  if (!user || profileLoading || !profile) {
    // Dark ground while auth and the profile resolve — no white flash.
    return <View style={styles.ground} />;
  }

  const isNew = !profile.onboarded && !profile.birthDate;
  return isNew ? <Redirect href="/onboarding" /> : <Redirect href="/(tabs)" />;
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
