import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { AccountForm } from "@/components/AccountForm";
import { SignInGuard } from "@/components/SignInGuard";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { hasAnyFieldNote } from "@/lib/firestore";

/** C.1 §1h — sign in to an existing field from the hello screen. */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  // C §2 guard — if an anonymous session with notes reaches this screen,
  // warn before those notes are left behind. No merge in v1.
  type Mode = "checking" | "guard" | "keep" | "kept" | "signin";
  const [mode, setMode] = useState<Mode>("checking");

  const decidedRef = useRef(false);
  useEffect(() => {
    // Decide exactly once, but only after auth state has settled — deciding
    // while `user` is still hydrating would silently skip the guard. A later
    // auth change (the link itself) must not yank the UI, hence the ref.
    if (loading || decidedRef.current) return;
    decidedRef.current = true;
    let cancelled = false;
    (async () => {
      if (user?.isAnonymous) {
        // Fail safe: if the probe errors, prefer the guard over a silent
        // bypass that could orphan notes.
        const holdsNotes = await hasAnyFieldNote(user.uid).catch(() => true);
        if (!cancelled) setMode(holdsNotes ? "guard" : "signin");
      } else {
        setMode("signin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        {mode === "guard" && (
          <SignInGuard
            onKeepFirst={() => setMode("keep")}
            onProceed={() => setMode("signin")}
            onCancel={() => router.back()}
          />
        )}

        {mode === "keep" && (
          <>
            <Text style={styles.eyebrow}>KEEP THIS FIELD</Text>
            <Text style={styles.lead}>an email and a password, and it&apos;s yours anywhere.</Text>
            {/* Keep-them-first stops here — no automatic sign-in after. */}
            <AccountForm mode="link" onDone={() => setMode("kept")} />
          </>
        )}

        {mode === "kept" && (
          <>
            <Text style={styles.lead}>kept. this field is yours, anywhere.</Text>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={styles.backLink}
              hitSlop={8}
              testID="signin-kept-return"
            >
              <Text style={styles.backText}>return →</Text>
            </Pressable>
          </>
        )}

        {mode === "signin" && (
          <>
            <Text style={styles.eyebrow}>ALREADY KEEPING A FIELD?</Text>
            <Text style={styles.lead}>sign in, and it returns.</Text>
            <AccountForm mode="signin" onDone={() => router.replace("/(tabs)")} />
          </>
        )}

        {mode !== "kept" && mode !== "guard" && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backLink}
            testID="signin-back"
          >
            <Text style={styles.backText}>← back</Text>
          </Pressable>
        )}
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
    paddingHorizontal: 32,
  },
  eyebrow: {
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
  },
  lead: {
    ...TypeScale.serifBody,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 36,
  },
  backLink: {
    marginTop: 32,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backText: {
    ...TypeScale.label,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.5)",
  },
});
