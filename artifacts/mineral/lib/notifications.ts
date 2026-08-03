/**
 * The morning call — Slice 6.
 *
 * Local notifications only; no push infrastructure. The body is DATA, not
 * copy: the current pointer's `mapEpigraph`, verbatim (fallback `subtitle`,
 * then the fixed holding line). No title, no sound — the map waits on the
 * lock screen; it does not ping.
 *
 * Choice + coordinates live in AsyncStorage ONLY — nothing goes to Firestore.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { fetchEncounterLibrary, selectEncounterForDay } from "@/lib/firestore";

const SETTING_KEY = "mineral_morning_call";
const OFFERED_KEY = "mineral_morning_call_offered";

/** §1 fallback when no encounter doc exists for the pointer. */
const HOLDING_BODY = "the map is holding today.";

/** §5 clamp bounds, minutes from midnight. */
const SUNRISE_MIN = 5 * 60 + 30; // 05:30
const SUNRISE_MAX = 9 * 60; // 09:00
const FALLBACK_HOUR = 8;

export type MorningCallSetting =
  | { mode: "hour"; hour: number }
  | { mode: "sunrise"; lat: number; lon: number };

export async function getMorningCall(): Promise<MorningCallSetting | null> {
  try {
    const raw = await AsyncStorage.getItem(SETTING_KEY);
    return raw ? (JSON.parse(raw) as MorningCallSetting) : null;
  } catch {
    return null;
  }
}

export async function setMorningCall(setting: MorningCallSetting): Promise<void> {
  await AsyncStorage.setItem(SETTING_KEY, JSON.stringify(setting));
}

/** The permission moment fires once per install — after the first close. */
export async function wasMorningCallOffered(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OFFERED_KEY)) === "1";
  } catch {
    return true; // storage broken → err on silence, never re-prompt loops
  }
}

export async function markMorningCallOffered(): Promise<void> {
  AsyncStorage.setItem(OFFERED_KEY, "1").catch(() => {});
}

/** §1 body: the pointer's epigraph, exactly as stored. */
async function bodyForPointer(sequenceDay: number, currentTurn: number): Promise<string> {
  try {
    const library = await fetchEncounterLibrary();
    const enc = selectEncounterForDay(library, sequenceDay, currentTurn);
    if (!enc) return HOLDING_BODY;
    return enc.mapEpigraph ?? enc.subtitle ?? HOLDING_BODY;
  } catch {
    return HOLDING_BODY;
  }
}

/** §5: that day's sunrise from coarse coords, clamped 05:30–09:00; 8:00 fallback. */
function minutesForDay(day: Date, setting: MorningCallSetting): number {
  if (setting.mode === "hour") return setting.hour * 60;
  try {
    // suncalc wants a time on the day in question; noon avoids DST edges.
    const SunCalc = require("suncalc") as typeof import("suncalc");
    const noon = new Date(day);
    noon.setHours(12, 0, 0, 0);
    const sunrise = SunCalc.getTimes(noon, setting.lat, setting.lon).sunrise;
    if (!sunrise || isNaN(sunrise.getTime())) return FALLBACK_HOUR * 60; // polar winter
    const m = sunrise.getHours() * 60 + sunrise.getMinutes();
    return Math.min(SUNRISE_MAX, Math.max(SUNRISE_MIN, m));
  } catch {
    return FALLBACK_HOUR * 60;
  }
}

const CHANNEL_ID = "morning-call";

/** Android 8+: silence is governed by the channel, not the payload. */
async function ensureSilentChannel(
  Notifications: typeof import("expo-notifications")
): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "the morning call",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null, // silent — the map does not ping
    vibrationPattern: null,
    enableVibrate: false,
  });
}

// §4 single-flight: AppState can churn (inactive/background/active) — chain
// rebuilds so cancel+schedule never interleave and the queue stays at 30.
let rescheduleChain: Promise<void> = Promise.resolve();

export function rescheduleMorningCall(
  sequenceDay: number,
  currentTurn: number
): Promise<void> {
  rescheduleChain = rescheduleChain
    .catch(() => {})
    .then(() => doReschedule(sequenceDay, currentTurn));
  return rescheduleChain;
}

/**
 * §4: cancel everything, reschedule the next 30 days from the CURRENT
 * pointer. Called on every foreground/background transition. OS permission
 * missing → total silence (queue stays empty).
 */
async function doReschedule(
  sequenceDay: number,
  currentTurn: number
): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");

  await Notifications.cancelAllScheduledNotificationsAsync();

  const setting = await getMorningCall();
  if (!setting) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return; // §2: denied → total silence
  await ensureSilentChannel(Notifications);

  const body = await bodyForPointer(sequenceDay, currentTurn);
  const now = new Date();

  let scheduled = 0;
  for (let i = 0; scheduled < 30 && i <= 30; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const minutes = minutesForDay(day, setting);
    const when = new Date(day);
    when.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (when <= now) continue; // today only if the call is still ahead

    await Notifications.scheduleNotificationAsync({
      content: {
        // §2: no title — the OS shows only "Mineral" + the line.
        body,
        // §2 silent delivery — expo's API spells "no sound" as `false`
        // (the spec's `sound: null` in the underlying OS payload).
        sound: false,
        data: { url: "/(tabs)/origin" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL_ID,
      },
    });
    scheduled++;
  }

  if (__DEV__) {
    // Gate: the queue is inspectable in dev.
    await dumpMorningCallQueue();
  }
}

/**
 * Dev-only gate helper: dumps the full scheduled queue — every entry's
 * fire time and body — to the console. No-op outside __DEV__.
 */
export async function dumpMorningCallQueue(): Promise<void> {
  if (!__DEV__ || Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  const queue = await Notifications.getAllScheduledNotificationsAsync();
  const lines = queue
    .map((q) => {
      const t = q.trigger as { date?: number | Date } | null;
      const when = t?.date ? new Date(t.date) : null;
      return { when, line: `${when ? when.toISOString() : "?"} · "${q.content.body}"` };
    })
    .sort((a, b) => (a.when?.getTime() ?? 0) - (b.when?.getTime() ?? 0))
    .map((e, i) => `  ${String(i + 1).padStart(2)}. ${e.line}`);
  console.log(`[morning call] ${queue.length} scheduled\n${lines.join("\n")}`);
}
