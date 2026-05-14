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

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { TypeScale } from "@/constants/typography";

interface AuthSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

type Mode = "signup" | "signin";

export default function AuthSheet({ visible, onDismiss, onSuccess }: AuthSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists. Sign in instead.");
      } else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Incorrect email or password.");
      } else if (msg.includes("weak-password")) {
        setError("Password must be at least 6 characters.");
      } else if (msg.includes("invalid-email")) {
        setError("Please enter a valid email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signup" ? "signin" : "signup"));
    setError(null);
  };

  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      borderColor: colors.border,
      backgroundColor: colors.card,
      fontFamily: TypeScale.body.fontFamily,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={styles.wrapper}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: "#120a1e",
              paddingBottom: insets.bottom + 24,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Drag indicator */}
          <View style={[styles.drag, { backgroundColor: colors.border }]} />

          <Text
            style={[
              TypeScale.screenTitle,
              { color: colors.textPrimary, marginBottom: 6 },
            ]}
          >
            {isSignup ? "create your account" : "welcome back"}
          </Text>
          <Text
            style={[
              TypeScale.body,
              { color: colors.textTertiary, marginBottom: 28 },
            ]}
          >
            {isSignup
              ? "your field notes are tied to your account."
              : "sign in to continue your practice."}
          </Text>

          <TextInput
            style={inputStyle}
            placeholder="email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={[inputStyle, { marginTop: 10 }]}
            placeholder="password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isSignup ? "new-password" : "current-password"}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? (
            <Text style={[TypeScale.body, { color: "#e08aaf", marginTop: 10 }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  TypeScale.body,
                  {
                    color: "#fff",
                    fontFamily: "Inter_500Medium",
                    fontSize: 15,
                  },
                ]}
              >
                {isSignup ? "begin" : "sign in"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={toggleMode} style={{ marginTop: 16 }}>
            <Text
              style={[TypeScale.body, { color: colors.textTertiary, textAlign: "center" }]}
            >
              {isSignup
                ? "already have an account? sign in"
                : "new here? create account"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  drag: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
    opacity: 0.4,
  },
  input: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
});
