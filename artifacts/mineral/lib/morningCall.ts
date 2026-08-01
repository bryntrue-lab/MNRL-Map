import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Platform } from "react-native";
import * as SunCalc from "suncalc";

import {
  fetchEncounterLibrary,
  selectEncounterForDay,
  type EncounterWithId,
} from "@/lib/firestore";

// ─────────────────────────────────────────────────────────────
// The morning call (§ morning call) — a single quiet line, once
// a day, at a time the map keeps. Everything here is LOCAL ONLY:
// AsyncStorage for the choice + coarse coordinates, nothing in
// Firestore. Web is a total no-op for every scheduling path.
// ─────────────────────────────────────────────────────────────

// ── Storage keys (all local) ──
export const MC_MODE_KEY = "mineral_morning_call_mode"; // "hour" | "sunrise" | "off"
export const MC_HOUR_KEY = "mineral_morning_call_hour"; // "0".."23"
export const MC_MINUTE_KEY = "mineral_morning_call_minute"; // "0".."59"
export const MC_COORDS_KEY = "mineral_morning_call_coords"; // JSON {lat,lng}
export const MC_PROMPT_SHOWN_KEY = "mineral_morning_call_prompt_shown"; // "1" once ever

export type MorningCallMode = "hour" | "sunrise" | "off";

export interface MorningCallChoice {
  mode: MorningCallMode;
  hour: number; // 0..23 — used when mode = "hour"
  minute: number; // 0..59
}

interface Coords {
  lat: number;
  lng: number;
}

// The queue horizon and the founder's fixed points.
const QUEUE_DAYS = 30;
const SUNRISE_MIN_MINUTES = 5 * 60 + 30; // 05:30 clamp floor
const SUNRISE_MAX_MINUTES = 9 * 60; // 09:00 clamp ceiling
const SUNRISE_FALLBACK_HOUR = 7; // 7:11 fallback when no sunrise / no location
const SUNRISE_FALLBACK_MINUTE = 11;

// Default hour-wheel choice.
export const DEFAULT_HOUR = 8;
export const DEFAULT_MINUTE = 0;

// The only line the map ever says when it can't hold today's epigraph.
const MAP_HOLDING_FALLBACK = "the map is holding today.";

const isWeb = Platform.OS === "web";

// ─────────────────────────────────────────────────────────────
// Local storage helpers
// ─────────────────────────────────────────────────────────────

export async function loadChoice(): Promise<MorningCallChoice | null> {
  try {
    const [mode, hour, minute] = await Promise.all([
      AsyncStorage.getItem(MC_MODE_KEY),
      AsyncStorage.getItem(MC_HOUR_KEY),
      AsyncStorage.getItem(MC_MINUTE_KEY),
    ]);
    if (mode !== "hour" && mode !== "sunrise" && mode !== "off") return null;
    return {
      mode: mode as MorningCallMode,
      hour: hour != null ? Number(hour) : DEFAULT_HOUR,
      minute: minute != null ? Number(minute) : DEFAULT_MINUTE,
    };
  } catch {
    return null;
  }
}

export async function saveChoice(choice: MorningCallChoice): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(MC_MODE_KEY, choice.mode),
      AsyncStorage.setItem(MC_HOUR_KEY, String(choice.hour)),
      AsyncStorage.setItem(MC_MINUTE_KEY, String(choice.minute)),
    ]);
  } catch {
    // Silence is the whole point — a failed write just means no calls.
  }
}

async function loadCoords(): Promise<Coords | null> {
  try {
    const raw = await AsyncStorage.getItem(MC_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number"
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
    return null;
  } catch {
    return null;
  }
}

async function saveCoords(coords: Coords): Promise<void> {
  try {
    await AsyncStorage.setItem(MC_COORDS_KEY, JSON.stringify(coords));
  } catch {}
}

export async function hasPromptBeenShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MC_PROMPT_SHOWN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(MC_PROMPT_SHOWN_KEY, "1");
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────

/** Notification permission — request if undetermined; never re-nag. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (isWeb) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/**
 * Coarse/approximate location — requested AT THAT MOMENT ONLY, when the
 * user picks "sunrise". iOS reduced accuracy (Accuracy.Lowest, no
 * background). Returns coordinates on success (also stored locally), or
 * null when declined/unavailable — the caller reverts to the hour wheel
 * without comment.
 */
export async function requestSunriseLocation(): Promise<Coords | null> {
  if (isWeb) return null;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    });
    const coords: Coords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
    await saveCoords(coords);
    return coords;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Body resolution — the current pointer's epigraph, verbatim.
// ─────────────────────────────────────────────────────────────

/**
 * The body is the mapEpigraph of the encounter at the user's CURRENT
 * sequence pointer, reproduced exactly. Fallback chain: mapEpigraph →
 * subtitle → "the map is holding today." Never any other generated text.
 */
export function resolveBody(
  library: EncounterWithId[],
  sequenceDay: number,
  currentTurn: number
): string {
  const encounter = selectEncounterForDay(library, sequenceDay, currentTurn);
  if (!encounter) return MAP_HOLDING_FALLBACK;
  if (encounter.mapEpigraph != null) return encounter.mapEpigraph;
  if (encounter.subtitle) return encounter.subtitle;
  return MAP_HOLDING_FALLBACK;
}

// ─────────────────────────────────────────────────────────────
// Sunrise math — per-day, from stored coarse coordinates.
// ─────────────────────────────────────────────────────────────

/**
 * Minutes-after-midnight (local) of sunrise on `day` at `coords`, clamped
 * to 05:30–09:00. Returns null when no sunrise exists (polar winter — the
 * caller falls back to 7:11).
 */
function sunriseMinutesFor(day: Date, coords: Coords): number | null {
  const times = SunCalc.getTimes(day, coords.lat, coords.lng);
  const sunrise = times.sunrise;
  // Polar winter (and other degeneracies) → Invalid Date.
  if (!sunrise || Number.isNaN(sunrise.getTime())) return null;
  const minutes = sunrise.getHours() * 60 + sunrise.getMinutes();
  return Math.min(SUNRISE_MAX_MINUTES, Math.max(SUNRISE_MIN_MINUTES, minutes));
}

/** The local fire time (h/m) for `day` under the given choice + coords. */
function fireTimeFor(
  day: Date,
  choice: MorningCallChoice,
  coords: Coords | null
): { hour: number; minute: number } {
  if (choice.mode !== "sunrise") {
    return { hour: choice.hour, minute: choice.minute };
  }
  // Sunrise mode: per-day sunrise, or the 7:11 fallback.
  if (!coords) {
    return { hour: SUNRISE_FALLBACK_HOUR, minute: SUNRISE_FALLBACK_MINUTE };
  }
  const minutes = sunriseMinutesFor(day, coords);
  if (minutes == null) {
    return { hour: SUNRISE_FALLBACK_HOUR, minute: SUNRISE_FALLBACK_MINUTE };
  }
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}

// ─────────────────────────────────────────────────────────────
// Scheduling — cancel all, queue the next 30 days.
// ─────────────────────────────────────────────────────────────

interface ScheduleInput {
  sequenceDay: number;
  currentTurn: number;
}

// Serialize rescheduling — mount + AppState changes can call this
// concurrently, and interleaved cancel-all/schedule pairs would duplicate
// the queue. Each call bumps this token at entry; after every await we
// abort if a newer call has superseded us. Only the latest wins.
let scheduleToken = 0;

/**
 * Cancel ALL scheduled notifications and reschedule the next 30 days at
 * the chosen time (per-day sunrise math when mode = "sunrise"), each
 * carrying the CURRENT pointer's epigraph as body. Because the body only
 * depends on the pointer at scheduling time, all 30 queued days carry the
 * same body; it changes naturally when rescheduled after the pointer
 * advances.
 *
 * OS permission denied, no stored choice, mode "off", or web → do nothing,
 * silently.
 */
export async function rescheduleMorningCall(
  input: ScheduleInput
): Promise<void> {
  if (isWeb) return;
  const myToken = ++scheduleToken;
  const superseded = () => scheduleToken !== myToken;
  try {
    const choice = await loadChoice();
    if (superseded()) return;
    // No choice or explicitly off → clear the queue and stop.
    if (!choice || choice.mode === "off") {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      return;
    }

    const granted = await ensureNotificationPermission();
    if (superseded()) return;
    if (!granted) return; // denied → do nothing, silently

    const coords =
      choice.mode === "sunrise" ? await loadCoords() : null;
    if (superseded()) return;

    // The body depends only on the current pointer — resolve once.
    let body = MAP_HOLDING_FALLBACK;
    try {
      const library = await fetchEncounterLibrary();
      body = resolveBody(library, input.sequenceDay, input.currentTurn);
    } catch {
      // Library unavailable — the map is holding today.
      body = MAP_HOLDING_FALLBACK;
    }
    if (superseded()) return;

    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    if (superseded()) return;

    const now = new Date();
    // Queue up to 30 upcoming local dates INCLUDING today (i = 0) when
    // today's trigger time is still ahead; only slots already past are skipped.
    for (let i = 0; i < QUEUE_DAYS; i++) {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + i
      );
      const { hour, minute } = fireTimeFor(day, choice, coords);
      const fireDate = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hour,
        minute,
        0,
        0
      );
      // Skip any slot already in the past (today's, if the time has passed).
      if (fireDate.getTime() <= now.getTime()) continue;
      if (superseded()) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          // No title — the OS shows only "Mineral" + this line.
          body,
          // Silent delivery — the founder's "sound null". The typed API
          // expresses silence as `false`; no sound is played either way.
          sound: false,
          data: { origin: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      }).catch(() => {});
    }
  } catch {
    // Any failure is silent — the app never nags.
  }
}
