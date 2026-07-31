import { router } from "expo-router";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OriginAtmosphere } from "@/components/Atmosphere";
import { AuthSheet } from "@/components/AuthSheet";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { functions } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────
// Settings — quiet, sparse. Three concerns only:
//   • keeping the field (link an email, Task C §2 dismiss-path)
//   • signing in on a new device (C.1 §1h)
//   • leaving, and taking everything with you (Task C §3)
// ─────────────────────────────────────────────────────────────

const HOLD_MS = 2000;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAnon = user?.isAnonymous ?? true;
  const email = user?.email ?? null;

  const [sheet, setSheet] = useState<null | "link" | "signin">(null);
  const [leaving, setLeaving] = useState<"idle" | "holding" | "working" | "failed">("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const leave = async () => {
    setLeaving("working");
    try {
      await httpsCallable(functions, "deleteAccount")();
      // Everything is gone server-side, auth user included. Return to the
      // beginning — the root screen starts a fresh anonymous session.
      router.replace("/");
    } catch (err) {
      console.warn("deleteAccount failed", err);
      setLeaving("failed");
    }
  };

  const startHold = () => {
    if (leaving === "working") return;
    setLeaving("holding");
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      leave();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setLeaving((s) => (s === "holding" ? "idle" : s));
  };

  return (
    <View style={styles.container}>
      <OriginAtmosphere />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.backHit} testID="settings-back">
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
          <Text style={styles.eyebrow}>SETTINGS</Text>
          <View style={styles.backHit} />
        </View>

        {/* the field */}
        <Text style={styles.sectionEyebrow}>YOUR FIELD</Text>
        {isAnon ? (
          <>
            <Pressable style={styles.row} onPress={() => setSheet("link")} testID="settings-link">
              <Text style={styles.rowText}>keep your field · add an email</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => setSheet("signin")} testID="settings-signin">
              <Text style={styles.rowText}>already keeping a field? sign in</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.row}>
            <Text style={styles.rowQuiet}>kept by {email ?? "your email"}</Text>
          </View>
        )}

        {/* leaving */}
        <Text style={[styles.sectionEyebrow, styles.sectionGap]}>LEAVING</Text>
        <Pressable
          style={styles.row}
          onPressIn={startHold}
          onPressOut={cancelHold}
          disabled={leaving === "working"}
          testID="settings-leave"
        >
          <Text style={[styles.rowText, styles.leaveText]}>
            {leaving === "working" ? "leaving…" : "leave, and take everything with you"}
          </Text>
          {leaving === "holding" && <Text style={styles.holdHint}>keep holding — to be sure</Text>}
          {leaving === "failed" && <Text style={styles.failText}>something held on. try again.</Text>}
        </Pressable>
        <Text style={styles.leaveNote}>
          your recordings, your notes, your map — erased everywhere, not kept anywhere.
        </Text>
      </ScrollView>

      <AuthSheet
        open={sheet != null}
        mode={sheet ?? "link"}
        onClose={() => setSheet(null)}
        onSuccess={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0510" },
  scroll: { paddingHorizontal: 28 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 36,
  },
  backHit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backGlyph: { fontSize: 18, color: "rgba(255,255,255,0.6)" },
  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
  },
  sectionEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.32)",
    marginBottom: 10,
  },
  sectionGap: { marginTop: 44 },
  row: {
    minHeight: 52,
    justifyContent: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.07)",
    paddingVertical: 12,
  },
  rowText: {
    fontFamily: FontFamily.sans400,
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
  },
  rowQuiet: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  leaveText: { color: "rgba(255,178,168,0.85)" },
  holdHint: {
    marginTop: 6,
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
  failText: {
    marginTop: 6,
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    color: "rgba(255,178,168,0.7)",
  },
  leaveNote: {
    marginTop: 12,
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.35)",
  },
});
