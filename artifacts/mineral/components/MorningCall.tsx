import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FontFamily } from "@/constants/typography";
import {
  DEFAULT_HOUR,
  DEFAULT_MINUTE,
  requestSunriseLocation,
  type MorningCallChoice,
} from "@/lib/morningCall";

// ─────────────────────────────────────────────────────────────
// The morning call — shared picker + the once-ever permission
// moment. Chapel vocabulary throughout. All user-facing strings
// here are canonical; never improvise.
// ─────────────────────────────────────────────────────────────

// "sunrise" appears as a choice alongside the hours on the wheel.
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** 24h → the label the wheel shows (e.g. 8 → "8:00", 0 → "12:00"). */
function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h12}:00 ${suffix}`;
}

interface TimePickerProps {
  /** Current selection. mode "sunrise" highlights the sunrise choice. */
  value: MorningCallChoice;
  onChange: (value: MorningCallChoice) => void;
  /** Called when sunrise is declined/unavailable → revert to the hour wheel. */
  onSunriseDeclined?: () => void;
}

/**
 * The time picker: an hour wheel with "sunrise" as a choice at the top.
 * Choosing sunrise requests coarse/approximate location AT THAT MOMENT
 * ONLY; if declined, the picker reverts to the hour wheel without comment.
 */
export function TimePicker({ value, onChange, onSunriseDeclined }: TimePickerProps) {
  const [requesting, setRequesting] = useState(false);

  const pickSunrise = async () => {
    if (requesting) return;
    if (Platform.OS === "web") {
      // Web has no location scheduling — revert quietly to the hour wheel.
      onSunriseDeclined?.();
      return;
    }
    setRequesting(true);
    const coords = await requestSunriseLocation();
    setRequesting(false);
    if (!coords) {
      // Declined or unavailable — revert to the hour wheel, no comment.
      onSunriseDeclined?.();
      onChange({ ...value, mode: "hour" });
      return;
    }
    onChange({ ...value, mode: "sunrise" });
  };

  const pickHour = (hour: number) => {
    onChange({ mode: "hour", hour, minute: 0 });
  };

  return (
    <View style={styles.picker} testID="morning-call-picker">
      <Pressable
        onPress={pickSunrise}
        style={styles.pickerRow}
        testID="morning-call-sunrise"
      >
        <Text
          style={[
            styles.pickerLabel,
            value.mode === "sunrise" && styles.pickerLabelActive,
          ]}
        >
          sunrise
        </Text>
      </Pressable>
      <ScrollView
        style={styles.wheel}
        showsVerticalScrollIndicator={false}
        testID="morning-call-hours"
      >
        {HOURS.map((h) => {
          const active = value.mode === "hour" && value.hour === h;
          return (
            <Pressable
              key={h}
              onPress={() => pickHour(h)}
              style={styles.pickerRow}
              testID={`morning-call-hour-${h}`}
            >
              <Text
                style={[styles.pickerLabel, active && styles.pickerLabelActive]}
              >
                {hourLabel(h)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface MorningCallMomentProps {
  /** "allow" — the user chose a time and granted the map its morning call. */
  onAllow: (choice: MorningCallChoice) => void;
  /** "not now" — total silence; no re-prompt ever. */
  onDismiss: () => void;
}

/**
 * The permission moment — shown once ever, after the first encounter close.
 * There is no re-prompt copy because there is no re-prompt.
 */
export function MorningCallMoment({ onAllow, onDismiss }: MorningCallMomentProps) {
  const [choice, setChoice] = useState<MorningCallChoice>({
    mode: "hour",
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
  });

  return (
    <View style={styles.moment} testID="morning-call-moment">
      <Text style={styles.headline}>the map can call you each morning.</Text>

      <TimePicker value={choice} onChange={setChoice} />

      <Pressable
        onPress={() => onAllow(choice)}
        style={styles.allow}
        testID="morning-call-allow"
      >
        <Text style={styles.allowText}>allow</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        style={styles.dismiss}
        testID="morning-call-dismiss"
      >
        <Text style={styles.dismissText}>not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  moment: {
    marginTop: 44,
    alignItems: "center",
    alignSelf: "stretch",
  },
  headline: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic",
    fontSize: 22,
    lineHeight: 27,
    textAlign: "center",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 24,
  },

  // Picker
  picker: {
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 20,
  },
  wheel: {
    maxHeight: 176,
    alignSelf: "stretch",
  },
  pickerRow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerLabel: {
    fontFamily: FontFamily.sans400,
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
  },
  pickerLabelActive: {
    color: "rgba(255,255,255,0.95)",
  },

  // Buttons
  allow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  allowText: {
    fontFamily: FontFamily.sans400,
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
  },
  dismiss: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  dismissText: {
    fontFamily: FontFamily.sans400,
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
});
