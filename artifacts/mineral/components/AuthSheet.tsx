import {
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/typography";
import { auth, db } from "@/lib/firebase";

export interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  /** "link" upgrades the anonymous user; "signin" replaces it. */
  mode: "link" | "signin";
  onSuccess?: () => void;
}

function firebaseCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    return String((e as { code: unknown }).code);
  }
  return "";
}

/**
 * C.1 §1h / Task C §2 — the reusable account sheet.
 *
 *  • "signin"  → signInWithEmailAndPassword (replaces the anonymous user;
 *                correct only for the hello path and Settings sign-in).
 *  • "link"    → linkWithCredential on the current anonymous user, preserving
 *                the uid and every field note; writes email to the user doc.
 *
 * The Settings screen imports { AuthSheet } with exactly this API.
 */
export function AuthSheet({ open, onClose, mode, onSuccess }: AuthSheetProps) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignin = mode === "signin";

  const reset = () => {
    setPassword("");
    setError(null);
    setNotice(null);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const addr = email.trim();
    if (!addr || !password) {
      setError("fill in both fields.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (isSignin) {
        await signInWithEmailAndPassword(auth, addr, password);
      } else {
        const current = auth.currentUser;
        if (!current) throw new Error("no-current-user");
        const credential = EmailAuthProvider.credential(addr, password);
        await linkWithCredential(current, credential);
        // Fire-and-forget: keep the email on the user doc (offline-safe).
        setDoc(doc(db, "users", current.uid), { email: addr }, { merge: true }).catch(
          () => {}
        );
      }
      reset();
      onSuccess?.();
    } catch (e: unknown) {
      const code = firebaseCode(e);
      if (isSignin) {
        // Wrong password / no such user — one quiet line.
        setError("that doesn't match. try again.");
      } else if (
        code === "auth/email-already-in-use" ||
        code === "auth/credential-already-in-use"
      ) {
        setError(
          "that address already keeps a field. try another, or come back later."
        );
      } else if (code === "auth/invalid-email") {
        setError("that doesn't look like an address. try again.");
      } else if (code === "auth/weak-password") {
        setError("a longer password keeps it safer. six characters or more.");
      } else {
        setError("that didn't hold. try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    const addr = email.trim();
    if (!addr) {
      setError("your address first, then a reset link.");
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, addr);
      setNotice("a reset link is on its way.");
    } catch {
      // Soft confirmation regardless — never reveal whether the address exists.
      setNotice("a reset link is on its way.");
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={styles.wrapper}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.drag} />

          <Text style={styles.title}>
            {isSignin ? "welcome back" : "keep this"}
          </Text>
          <Text style={styles.subtitle}>
            {isSignin
              ? "sign in to return to your field."
              : "and everything else that finds you."}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isSignin ? "current-password" : "new-password"}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.submit, { opacity: pressed ? 0.85 : 1 }]}
            onPress={submit}
            disabled={loading}
            testID="auth-submit"
          >
            {loading ? (
              <ActivityIndicator color="#050208" />
            ) : (
              <Text style={styles.submitText}>
                {isSignin ? "sign in →" : "keep it →"}
              </Text>
            )}
          </Pressable>

          {isSignin ? (
            <Pressable onPress={sendReset} style={styles.resetWrap} hitSlop={12}>
              <Text style={styles.resetText}>send a reset link</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default AuthSheet;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#120a1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  drag: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  title: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 24,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 26,
  },
  input: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    fontFamily: FontFamily.sans400,
  },
  error: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    lineHeight: 18,
    color: "#e08aaf",
    marginTop: 12,
  },
  notice: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(168,156,220,0.85)",
    marginTop: 12,
  },
  submit: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  submitText: {
    fontFamily: FontFamily.sans500,
    fontSize: 15,
    color: "#050208",
    letterSpacing: 0.2,
  },
  resetWrap: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  resetText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.42)",
  },
});
