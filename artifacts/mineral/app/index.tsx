import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety valve: if Firebase auth never resolves (e.g. network offline),
  // stop waiting after 4 seconds and fall through to onboarding.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (loading && !timedOut) {
    // Dark ground while Firebase resolves — no white flash.
    return <View style={{ flex: 1, backgroundColor: "#0a0510" }} />;
  }

  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href="/onboarding" />;
}
