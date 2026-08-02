import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FontFamily } from "@/constants/typography";
import {
  COUNTERWEIGHT_QUESTION,
  FUTURE_COUNTERWEIGHT_QUESTION,
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
  /** Adds a grab handle with swipe-down-to-dismiss (§C.1 1e). */
  swipeToDismiss?: boolean;
  children: React.ReactNode;
}

export function SheetShell({
  open,
  onClose,
  bottomPad,
  testID,
  swipeToDismiss,
  children,
}: SheetShellProps) {
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  // §C.1 1e / 2.1.2 — the sheet rises with the keyboard so the field is
  // never clipped at the sheet's top edge. A transform (not a wrapper
  // layer) so the backdrop stays tappable. iOS only: Android's window
  // resizes (softwareKeyboardLayoutMode default), web needs nothing.
  const kbRise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) =>
      Animated.timing(kbRise, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start()
    );
    const hide = Keyboard.addListener("keyboardWillHide", (e) =>
      Animated.timing(kbRise, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start()
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kbRise]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 48 || g.vy > 0.8) {
            Keyboard.dismiss();
            onCloseRef.current();
          }
        },
      }),
    []
  );

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
        onPress={() => {
          // §C.1 1e — tap outside: the keyboard leaves first, then the sheet.
          Keyboard.dismiss();
          onClose();
        }}
        testID={`${testID}-backdrop`}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: bottomPad + 18,
            transform: [
              {
                translateY: Animated.add(
                  slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [460, 0],
                  }),
                  kbRise
                ),
              },
            ],
          },
        ]}
        testID={testID}
      >
        {swipeToDismiss && (
          <View style={styles.handleZone} {...handlePan.panHandlers} testID={`${testID}-handle`}>
            <View style={styles.handleBar} />
          </View>
        )}
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
  /** §6 — opens the standard capture sheet against this position's mapRef. */
  onKeepWhatComes?: () => void;
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
  onKeepWhatComes,
}: ReadingSheetProps) {
  const r = resolve(displayAge);
  const season = seasonFor(r);
  const hasCw = displayAge >= 14;
  const cwDate = hasCw ? counterweightDate(birthDate, now, displayAge, currentAge) : null;
  // Tense is set by the counterweight date vs. the device's today —
  // never by the pendulum position alone (§C.1 1b).
  const cwFuture = cwDate != null && cwDate.getTime() > now.getTime();
  const atNow = Math.abs(displayAge - currentAge) < 0.01;
  const cwQuestion = hasCw
    ? (cwFuture ? FUTURE_COUNTERWEIGHT_QUESTION : COUNTERWEIGHT_QUESTION)[
        resolve(displayAge - 14).phase
      ]
    : null;
  const cwEyebrow = cwFuture
    ? "THE COUNTERWEIGHT, TO COME"
    : atNow
      ? "YOUR COUNTERWEIGHT TODAY"
      : "THE COUNTERWEIGHT";

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
          <Text style={styles.cwEyebrow}>{cwEyebrow}</Text>
          <Text style={styles.cwDate}>{ritualDateLabel(cwDate)}</Text>
          <Text style={styles.cwQuestion}>{cwQuestion}</Text>
          {onKeepWhatComes && (
            <Pressable
              onPress={onKeepWhatComes}
              style={styles.keepWhatComes}
              hitSlop={6}
              testID="counterweight-keep"
            >
              <Text style={styles.keepWhatComesText}>keep what comes →</Text>
            </Pressable>
          )}
        </Pressable>
      )}

      <Pressable onPress={onCompanions} style={styles.companionsLink} testID="companions-link">
        <Text style={styles.companionsLinkText}>four companions of this moment →</Text>
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
      <Text style={styles.eyebrow}>THE CONTINUUM OF THIS MOMENT</Text>

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

  handleZone: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: -16,
    marginBottom: 2,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
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

  keepWhatComes: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  keepWhatComesText: {
    fontFamily: FontFamily.sans400,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(235,228,255,0.7)",
    textDecorationLine: "underline",
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
