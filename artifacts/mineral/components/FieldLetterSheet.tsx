import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { httpsCallable } from "firebase/functions";

import { LinkPrimary } from "@/components/Links";
import { SheetShell } from "@/components/OriginSheets";
import colors from "@/constants/colors";
import { TypeScale } from "@/constants/typography";
import { functions } from "@/lib/firebase";

type LetterState = "ready" | "requesting" | "asked" | "failed";

interface FieldLetterSheetProps {
  open: boolean;
  onClose: () => void;
  bottomPad: number;
}

/**
 * Slice P privacy boundary: this callable receives no client data. The server
 * derives the caller's email and all request metadata from trusted sources.
 */
export function FieldLetterSheet({
  open,
  onClose,
  bottomPad,
}: FieldLetterSheetProps) {
  const [state, setState] = useState<LetterState>("ready");

  useEffect(() => {
    if (open) setState("ready");
  }, [open]);

  const requestLetter = async () => {
    if (state === "requesting" || state === "asked") return;
    setState("requesting");
    try {
      const callable = httpsCallable<undefined, { ok: true }>(
        functions,
        "requestLetter"
      );
      // No argument is intentionally sent: identity and metadata are
      // server-derived and no note content ever leaves this client.
      await callable();
      setState("asked");
    } catch {
      setState("failed");
    }
  };

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      bottomPad={bottomPad}
      swipeToDismiss
      modal
      testID="field-letter-sheet"
    >
      {state === "asked" ? (
        <Text style={styles.success} testID="field-letter-success">
          asked. a letter begins with hers — watch your inbox.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>A LETTER</Text>
          <Text style={styles.title}>your field, read by hand.</Text>
          <Text style={styles.body}>
            A letter is written by Bryn — the practitioner behind Mineral —
            personally, one at a time. Nothing in your field is shared by
            asking: she writes to you first, and you choose what to share with
            her, in your own words, by reply.
          </Text>
          <View style={styles.action}>
            <LinkPrimary
              label="request →"
              onPress={requestLetter}
              disabled={state === "requesting"}
              testID="field-letter-request"
            />
          </View>
          {state === "failed" ? (
            <Text style={styles.failed} testID="field-letter-failed">
              not asked — try again.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...TypeScale.eyebrow,
    color: colors.light.textMuted,
  },
  title: {
    ...TypeScale.serifMedium,
    color: colors.light.textPrimary,
    marginTop: 10,
  },
  body: {
    ...TypeScale.bodyLarge,
    color: colors.light.textSecondary,
    marginTop: 20,
  },
  action: {
    marginTop: 22,
  },
  success: {
    ...TypeScale.serifMedium,
    color: colors.light.textPrimary,
  },
  failed: {
    ...TypeScale.metadata,
    color: colors.light.signalText,
    marginTop: 4,
  },
});