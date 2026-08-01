import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider, useUser } from "@/context/UserContext";
import { rescheduleMorningCall } from "@/lib/morningCall";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * The morning call's scheduler — reschedules the next 30 days on every
 * app foreground/background transition (and once on mount), and routes a
 * tapped call to the Origin tab. Web is a no-op throughout. Silent on OS
 * denial. Lives inside UserProvider so it reads the live sequence pointer.
 */
function MorningCallScheduler() {
  const { profile } = useUser();
  const pointerRef = useRef({ sequenceDay: 1, currentTurn: 1 });
  pointerRef.current = {
    sequenceDay: profile?.sequenceDay ?? 1,
    currentTurn: profile?.currentTurn ?? 1,
  };

  // Reschedule on every foreground/background transition (and on mount).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const run = () => {
      rescheduleMorningCall(pointerRef.current).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener("change", run);
    return () => sub.remove();
  }, []);

  // Tapping the call opens the app on the Origin tab.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { origin?: boolean }
          | undefined;
        if (data?.origin) {
          router.push("/(tabs)/origin");
        }
      }
    );
    return () => sub.remove();
  }, []);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="birthdate" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* The encounter is a held space — no tab bar, no swipe-back out. */}
      <Stack.Screen
        name="encounter"
        options={{ headerShown: false, animation: "fade", gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <UserProvider>
                  <MorningCallScheduler />
                  <RootLayoutNav />
                </UserProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
