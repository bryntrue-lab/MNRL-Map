import { router } from "expo-router";
import { httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { AccountForm } from "@/components/AccountForm";
import { LinkPrimary, LinkSecondary } from "@/components/Links";
import { SignInGuard } from "@/components/SignInGuard";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { functions } from "@/lib/firebase";
import { hasAnyFieldNote } from "@/lib/firestore";
import { dumpMorningCallQueue } from "@/lib/notifications";

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
      setDeleteError("something held on. try again.");
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
              <LinkPrimary
                label="keep this. →"
                onPress={() => setForm("link")}
                style={styles.actionLine}
                testID="settings-keep-this"
              />
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
              <LinkSecondary
                label="already keeping a field? sign in"
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
              />
            )}
          </>
        ) : (
          <>
            <Text style={styles.bodyLine}>
              {linked ? "kept. this field is yours, anywhere." : `keeping as ${user?.email ?? "—"}`}
            </Text>
            <LinkSecondary
              label="sign out →"
              onPress={signOutNow}
              style={styles.actionLine}
              testID="settings-sign-out"
            />
          </>
        )}

        {/* Slice 6 — the permanent path to the morning call (no re-prompt). */}
        {Platform.OS !== "web" && (
          <LinkSecondary
            label="the morning call · set a time"
            onPress={() => router.push("/morning-call?from=settings")}
            style={styles.actionLine}
            testID="settings-morning-call"
          />
        )}
        {/* Dev-only gate: dump the scheduled queue (fire time + body). */}
        {__DEV__ && Platform.OS !== "web" && (
          <LinkSecondary
            label="dev · dump notification queue"
            onPress={() => dumpMorningCallQueue()}
            style={styles.actionLine}
            testID="settings-dev-queue"
          />
        )}

        {/* ── Release ── */}
        <Text style={[styles.sectionLabel, styles.releaseLabel]}>RELEASE</Text>
        <Text style={styles.bodyLine}>
          Releasing your field deletes everything — every note, every
          recording, the account itself — permanently. There is no way back.
        </Text>
        {!confirmingDelete ? (
          <LinkSecondary
            label="release this field →"
            onPress={() => setConfirmingDelete(true)}
            style={styles.actionLine}
            testID="settings-delete"
          />
        ) : (
          <>
            {/* CS §1 — confirm headline */}
            <Text style={styles.confirmHeadline}>release this field.</Text>
          <View style={styles.confirmRow}>
            {deleting ? (
              <Pressable style={styles.actionLine} disabled testID="settings-delete-confirm">
                <ActivityIndicator size="small" color="rgba(224,138,175,0.9)" />
              </Pressable>
            ) : (
              <LinkSecondary
                label="yes — release everything"
                onPress={releaseField}
                disabled={deleting}
                style={styles.actionLine}
                testID="settings-delete-confirm"
              />
            )}
            {!deleting && (
              <LinkSecondary
                label="keep it"
                onPress={() => setConfirmingDelete(false)}
                style={styles.actionLine}
                testID="settings-delete-cancel"
              />
            )}
          </View>
          </>
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
    ...TypeScale.metadata,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.58)",
  },
  closeTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  closeText: {
    ...TypeScale.sectionTitle,
    color: "rgba(255,255,255,0.5)",
  },
  sectionLabel: {
    ...TypeScale.sectionTitle,
    textTransform: "lowercase",
    color: colors.light.textSecondary,
    marginTop: 32,
    marginBottom: 13,
  },
  releaseLabel: {
    marginTop: 40,
  },
  bodyLine: {
    ...TypeScale.serifSmall,
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
  confirmHeadline: {
    ...TypeScale.serifSmall,
    color: "#ffffff",
    marginBottom: 10,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 28,
    alignItems: "center",
  },
  errorLine: {
    ...TypeScale.serifSmall,
    color: "#E08AAF",
    marginTop: 8,
  },
});
