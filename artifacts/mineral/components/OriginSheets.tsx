import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FontFamily } from "@/constants/typography";
import {
  COUNTERWEIGHT_QUESTION,
  SEASON_MODE,
  companionsFor,
  counterweightDate,
  dateAtAge,
  resolve,
  ritualDateLabel,
  seasonFor,
} from "@/lib/spiral";

// ─────────────────────────────────────────────────────────────
// Sheet shell — slides up to ~45–50% height. Manual dismissal only:
// backdrop tap or the caller closing it. The map's still point and
// needle stay visible above (the screen dims only the arcs).
// ─────────────────────────────────────────────────────────────

interface SheetShellProps {
  open: boolean;
  onClose: () => void;
  bottomPad: number;
  testID: string;
  children: React.ReactNode;
}

export function SheetShell({ open, onClose, bottomPad, testID, children }: SheetShellProps) {
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        duration: 340,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, slide]);

  if (!mounted) return null;

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        testID={`${testID}-backdrop`}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: bottomPad + 18,
            transform: [
              {
                translateY: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [460, 0],
                }),
              },
            ],
          },
        ]}
        testID={testID}
      >
        {children}
      </Animated.View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Reading sheet — §10. Always reflects the DISPLAYED position.
// ─────────────────────────────────────────────────────────────

interface ReadingSheetProps {
  open: boolean;
  displayAge: number;
  currentAge: number;
  birthDate: Date;
  now: Date;
  bottomPad: number;
  onClose: () => void;
  onCompanions: () => void;
  onSwingTo: (age: number) => void;
}

export function ReadingSheet({
  open,
  displayAge,
  currentAge,
  birthDate,
  now,
  bottomPad,
  onClose,
  onCompanions,
  onSwingTo,
}: ReadingSheetProps) {
  const r = resolve(displayAge);
  const season = seasonFor(r);
  const hasCw = displayAge >= 14;
  const cwDate = hasCw ? counterweightDate(birthDate, now, displayAge, currentAge) : null;
  const cwQuestion = hasCw ? COUNTERWEIGHT_QUESTION[resolve(displayAge - 14).phase] : null;

  return (
    <SheetShell open={open} onClose={onClose} bottomPad={bottomPad} testID="reading-sheet">
      <Text style={styles.eyebrow}>THE MAP OFFERS, THIS SEASON</Text>

      {season ? (
        <>
          <Text style={styles.seasonTitle}>{season.title}</Text>
          <Text style={styles.seasonMode}>{SEASON_MODE[r.phase]}</Text>
          <View style={styles.divider} />
          <Text style={styles.seasonQuestion}>{season.question}</Text>
        </>
      ) : (
        // Turn ≥ 4 — the generic mode line carries the season alone.
        <Text style={styles.seasonTitle}>{SEASON_MODE[r.phase]}</Text>
      )}

      {hasCw && cwDate && cwQuestion && (
        <Pressable
          style={styles.cwCard}
          onPress={() => onSwingTo(displayAge - 14)}
          testID="counterweight-card"
        >
          <Text style={styles.cwEyebrow}>THE COUNTERWEIGHT</Text>
          <Text style={styles.cwDate}>{ritualDateLabel(cwDate)}</Text>
          <Text style={styles.cwQuestion}>{cwQuestion}</Text>
        </Pressable>
      )}

      <Pressable onPress={onCompanions} style={styles.companionsLink} testID="companions-link">
        <Text style={styles.companionsLinkText}>four companions on the chord →</Text>
      </Pressable>
    </SheetShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Companions sheet — §10. Rows swing the needle and close.
// Missing companions are omitted, never greyed.
// ─────────────────────────────────────────────────────────────

interface CompanionsSheetProps {
  open: boolean;
  displayAge: number;
  birthDate: Date;
  bottomPad: number;
  onClose: () => void;
  onSwingTo: (age: number) => void;
}

export function CompanionsSheet({
  open,
  displayAge,
  birthDate,
  bottomPad,
  onClose,
  onSwingTo,
}: CompanionsSheetProps) {
  const companions = companionsFor(displayAge);

  return (
    <SheetShell open={open} onClose={onClose} bottomPad={bottomPad} testID="companions-sheet">
      <Text style={styles.eyebrow}>FOUR COMPANIONS ON THE CHORD</Text>

      {companions.map((c) => (
        <Pressable
          key={c.key}
          style={styles.companionRow}
          onPress={() => onSwingTo(c.age)}
          testID={`companion-${c.key}`}
        >
          <View style={styles.companionLeft}>
            <Text style={styles.companionName}>{c.name}</Text>
            <Text style={styles.companionDesc}>{c.desc}</Text>
          </View>
          <View style={styles.companionRight}>
            <Text style={styles.companionYear}>
              {dateAtAge(birthDate, c.age).getFullYear()}
            </Text>
            <Text style={styles.companionAge}>age {Math.round(c.age)}</Text>
          </View>
        </Pressable>
      ))}
    </SheetShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast — one quiet line, then gone ("still to come.")
// ─────────────────────────────────────────────────────────────

interface QuietToastProps {
  toast: { key: number; text: string } | null;
  bottom: number;
  onDone: () => void;
}

export function QuietToast({ toast, bottom, onDone }: QuietToastProps) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }).start(
        ({ finished }) => finished && onDone()
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [toast, fade, onDone]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[styles.toast, { bottom, opacity: fade, pointerEvents: "none" }]}
      testID="quiet-toast"
    >
      <Text style={styles.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0e0a18",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 30,
    paddingTop: 26,
  },

  eyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 8.5,
    letterSpacing: 2.6,
    color: "rgba(200,190,225,0.5)",
    marginBottom: 16,
  },

  seasonTitle: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 27,
    color: "rgba(240,235,255,0.95)",
    marginBottom: 8,
  },
  seasonMode: {
    fontFamily: FontFamily.sans400,
    fontSize: 9.5,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: "rgba(200,190,225,0.45)",
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 14,
  },
  seasonQuestion: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 19,
    lineHeight: 27,
    color: "rgba(235,228,255,0.8)",
    marginBottom: 20,
  },

  cwCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingTop: 16,
    marginBottom: 18,
  },
  cwEyebrow: {
    fontFamily: FontFamily.sans500,
    fontSize: 8,
    letterSpacing: 2.4,
    color: "rgba(200,190,225,0.45)",
    marginBottom: 8,
  },
  cwDate: {
    fontFamily: FontFamily.sans500,
    fontSize: 13,
    letterSpacing: 0.3,
    color: "rgba(235,228,255,0.85)",
    marginBottom: 6,
  },
  cwQuestion: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14.5,
    lineHeight: 21,
    color: "rgba(235,228,255,0.6)",
  },

  companionsLink: {
    paddingVertical: 6,
  },
  companionsLinkText: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(200,190,225,0.55)",
  },

  companionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  companionLeft: {
    flexShrink: 1,
    paddingRight: 16,
  },
  companionName: {
    fontFamily: FontFamily.sans500,
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(235,228,255,0.8)",
    marginBottom: 3,
  },
  companionDesc: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 13.5,
    color: "rgba(235,228,255,0.5)",
  },
  companionRight: {
    alignItems: "flex-end",
  },
  companionYear: {
    fontFamily: FontFamily.sans500,
    fontSize: 15,
    color: "rgba(235,228,255,0.9)",
  },
  companionAge: {
    fontFamily: FontFamily.sans400,
    fontSize: 11,
    color: "rgba(235,228,255,0.4)",
    marginTop: 2,
  },

  toast: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toastText: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 14,
    color: "rgba(235,228,255,0.65)",
    backgroundColor: "rgba(14,10,24,0.92)",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    overflow: "hidden",
  },
});
