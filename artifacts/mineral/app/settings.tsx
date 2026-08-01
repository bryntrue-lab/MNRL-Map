import { router } from "expo-router";
import { httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { AccountForm } from "@/components/AccountForm";
import { SignInGuard } from "@/components/SignInGuard";
import { FontFamily } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { functions } from "@/lib/firebase";
import { hasAnyFieldNote } from "@/lib/firestore";

/**
 * Task C §2/§3 + C.1 §1h — Settings: keep this (link), sign in, sign out,
 * and the full release (deleteAccount cascade).
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logOut } = useAuth();
  const [form, setForm] = useState<null | "link" | "signin">(null);
  const [guarding, setGuarding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false); // post-link confirmation line

  const isAnon = user?.isAnonymous ?? true;

  const signOutNow = async () => {
    await logOut();
    router.replace("/onboarding");
  };

  const releaseField = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await httpsCallable(functions, "deleteAccount")();
      await logOut().catch(() => {}); // auth record is already gone
      router.replace("/onboarding");
    } catch {
      setDeleteError("the release didn't complete. try again.");
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Text style={styles.title}>SETTINGS</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeTarget} testID="settings-close">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* ── Account ── */}
        <Text style={styles.sectionLabel}>YOUR FIELD</Text>

        {isAnon && !linked ? (
          <>
            <Text style={styles.bodyLine}>
              this field lives only on this device, for now.
            </Text>
            {form === "link" ? (
              <View style={styles.formWrap}>
                <AccountForm
                  mode="link"
                  onDone={() => {
                    setForm(null);
                    setLinked(true);
                  }}
                />
              </View>
            ) : (
              <Pressable onPress={() => setForm("link")} style={styles.actionLine} testID="settings-keep-this">
                <Text style={styles.actionText}>keep this. →</Text>
              </Pressable>
            )}

            {guarding ? (
              <View style={styles.formWrap}>
                <SignInGuard
                  onKeepFirst={() => {
                    // Routes to the link flow for THIS anonymous field, then
                    // stops — no automatic sign-in after.
                    setGuarding(false);
                    setForm("link");
                  }}
                  onProceed={() => {
                    setGuarding(false);
                    setForm("signin");
                  }}
                  onCancel={() => setGuarding(false)}
                />
              </View>
            ) : form === "signin" ? (
              <View style={styles.formWrap}>
                <AccountForm mode="signin" onDone={() => router.replace("/(tabs)")} />
              </View>
            ) : (
              <Pressable
                onPress={async () => {
                  // C §2 guard — an anonymous field with notes deserves a
                  // warning before it's left behind. No merge in v1.
                  const uid = user?.uid;
                  // Fail safe: if the probe errors, prefer the guard over a
                  // silent bypass that could orphan notes.
                  const holdsNotes = uid
                    ? await hasAnyFieldNote(uid).catch(() => true)
                    : false;
                  if (holdsNotes) setGuarding(true);
                  else setForm("signin");
                }}
                style={styles.actionLine}
                testID="settings-sign-in"
              >
                <Text style={styles.quietAction}>already keeping a field? sign in</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.bodyLine}>
              {linked ? "kept. this field is yours, anywhere." : `keeping as ${user?.email ?? "—"}`}
            </Text>
            <Pressable onPress={signOutNow} style={styles.actionLine} testID="settings-sign-out">
              <Text style={styles.actionText}>sign out →</Text>
            </Pressable>
          </>
        )}

        {/* ── Release ── */}
        <Text style={[styles.sectionLabel, styles.releaseLabel]}>RELEASE</Text>
        <Text style={styles.bodyLine}>
          delete this account and everything it keeps — every note, every
          recording, every trace. this cannot be undone.
        </Text>
        {!confirmingDelete ? (
          <Pressable
            onPress={() => setConfirmingDelete(true)}
            style={styles.actionLine}
            testID="settings-delete"
          >
            <Text style={styles.dangerText}>release this field →</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmRow}>
            <Pressable onPress={releaseField} style={styles.actionLine} disabled={deleting} testID="settings-delete-confirm">
              {deleting ? (
                <ActivityIndicator size="small" color="rgba(224,138,175,0.9)" />
              ) : (
                <Text style={styles.dangerText}>yes — release everything</Text>
              )}
            </Pressable>
            {!deleting && (
              <Pressable onPress={() => setConfirmingDelete(false)} style={styles.actionLine} testID="settings-delete-cancel">
                <Text style={styles.quietAction}>keep it</Text>
              </Pressable>
            )}
          </View>
        )}
        {deleteError && <Text style={styles.errorLine}>{deleteError}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  content: {
    paddingHorizontal: 28,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  title: {
    fontFamily: FontFamily.sans500,
    fontSize: 11,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.6)",
  },
  closeTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
  },
  sectionLabel: {
    fontFamily: FontFamily.sans500,
    fontSize: 9,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
  },
  releaseLabel: {
    marginTop: 56,
  },
  bodyLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 10,
  },
  formWrap: {
    marginTop: 16,
    marginBottom: 8,
  },
  actionLine: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  actionText: {
    fontFamily: FontFamily.sans500,
    fontSize: 14,
    letterSpacing: 0.4,
    color: "rgba(235,228,255,0.9)",
  },
  quietAction: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },
  dangerText: {
    fontFamily: FontFamily.sans500,
    fontSize: 13,
    letterSpacing: 0.4,
    color: "rgba(224,138,175,0.9)",
  },
  confirmRow: {
    flexDirection: "row",
    gap: 28,
    alignItems: "center",
  },
  errorLine: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13,
    color: "rgba(224,138,175,0.9)",
    marginTop: 8,
  },
});
