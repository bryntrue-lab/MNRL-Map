import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { LinkPrimary, LinkSecondary } from "@/components/Links";
import { TypeScale } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";

/**
 * Task C §2 / C.1 §1h — one quiet email + password form, two modes:
 *   "link"   — "keep this.": linkWithCredential upgrades the anonymous
 *              session in place (uid preserved, every note stays).
 *   "signin" — "already keeping a field? sign in": returns to an existing
 *              field on a new device / reinstall.
 */
export function AccountForm({
  mode,
  onDone,
}: {
  mode: "link" | "signin";
  onDone: () => void;
}) {
  const { linkWithEmail, signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
    const e = email.trim();
    if (!e || password.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "link") await linkWithEmail(e, password);
      else await signIn(e, password);
      onDone();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("that doesn't match. try again.");
      } else if (code === "auth/user-not-found") {
        setError("no field is kept under that email.");
      } else if (code === "auth/email-already-in-use" || code === "auth/credential-already-in-use") {
        setError("that email already keeps a field. sign in instead.");
      } else if (code === "auth/invalid-email") {
        setError("that doesn't look like an email.");
      } else if (code === "auth/weak-password") {
        setError("a longer password, please — six characters or more.");
      } else {
        setError("something didn't take. try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    const e = email.trim();
    if (!e || busy) return;
    try {
      await resetPassword(e);
      setResetSent(true);
      setError(null);
    } catch {
      setError("couldn't send the link. check the email address.");
    }
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email"
        placeholderTextColor="rgba(255,255,255,0.5)"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="account-email"
      />
      <TextInput
        ref={passwordRef}
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="password"
        placeholderTextColor="rgba(255,255,255,0.5)"
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="account-password"
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {resetSent && <Text style={styles.quietLine}>a reset link is on its way.</Text>}

      {busy ? (
        <Pressable
          style={[styles.submit, { opacity: email.trim() && password ? 1 : 0.4 }]}
          disabled
          testID="account-submit"
        >
          <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
        </Pressable>
      ) : (
        <LinkPrimary
          label={mode === "link" ? "keep this. →" : "sign in →"}
          onPress={submit}
          disabled={busy}
          style={[styles.submit, { opacity: email.trim() && password ? 1 : 0.4 }]}
          testID="account-submit"
        />
      )}

      {mode === "signin" && !resetSent && (
        <LinkSecondary
          label="send a reset link"
          onPress={sendReset}
          style={styles.resetLink}
          testID="account-reset"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    marginBottom: 18,
  },
  error: {
    ...TypeScale.serifSmall,
    color: "#E08AAF",
    marginBottom: 14,
  },
  quietLine: {
    ...TypeScale.label,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.5)",
  },
  submit: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  resetLink: {
    marginTop: 16,
    minHeight: 32,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
