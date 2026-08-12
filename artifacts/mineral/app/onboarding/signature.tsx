import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COUNTRIES, type Country } from "@/constants/countries";
import { TypeScale } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkPrimary, LinkSecondary, LinkWhisper } from "@/components/Links";
import OnboardingFooter from "@/components/OnboardingFooter";
import { useUser } from "@/context/UserContext";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/map",
  "/onboarding/practice",
  "/onboarding/begin",
];

const { height } = Dimensions.get("window");

const isWeb = Platform.OS === "web";

/** Digits → YYYY-MM-DD as the user types (web fallback only). */
function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function parseBirthDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Noon local time — keeps the calendar day stable across time zones.
  const date = new Date(y, mo - 1, d, 12);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// QA (2026-08-12) — founder call: hide birth time / city / country for now.
// All plumbing (pickers, geocoded autocomplete, country modal, save paths)
// stays intact behind this flag.
const SHOW_EXTENDED_BIRTH_FIELDS = false;

const toHHmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

interface CitySuggestion {
  label: string; // "City, Region"
  countryCode: string; // ISO-2, uppercase ("" when absent)
  countryName: string;
}

/** Photon (OpenStreetMap) place autocomplete — free, keyless, HTTPS. */
async function fetchCitySuggestions(
  q: string,
  signal: AbortSignal
): Promise<CitySuggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: {
      properties?: {
        name?: string;
        state?: string;
        country?: string;
        countrycode?: string;
        osm_key?: string;
        osm_value?: string;
      };
    }[];
  };
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (!p?.name || p.osm_key !== "place") continue;
    if (!["city", "town", "village", "hamlet", "municipality", "borough"].includes(p.osm_value ?? ""))
      continue;
    const label = p.state && p.state !== p.name ? `${p.name}, ${p.state}` : p.name;
    const key = `${label}|${p.countrycode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label,
      countryCode: (p.countrycode ?? "").toUpperCase(),
      countryName: p.country ?? "",
    });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Slice 5 — the app's ONLY birth-date form, ever. Writes
 * users/{uid}.birthDate (+ optional time/place) directly: one source of
 * truth. Reached from onboarding step 3, and from the Origin tab's empty
 * state (from=origin), which returns there after saving.
 *
 * Slice E1 — unlocks panel removed; "When did you arrive?" + subtitle;
 * native date wheel (required) · native time picker (optional, one-tap
 * skip) · free-text place (optional). Stored formats are what Human
 * Design will need later: YYYY-MM-DD · HH:mm · string as typed.
 */
export default function SignatureScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUser();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOrigin = from === "origin";

  // Native: Date objects from the wheels. Web fallback: text entry.
  const [birthDateObj, setBirthDateObj] = useState<Date | null>(null);
  const [birthTimeObj, setBirthTimeObj] = useState<Date | null>(null);
  const [webDate, setWebDate] = useState("");
  const [webTime, setWebTime] = useState("");
  // F1 — structured birth place: city text + country from the static ISO
  // list.
  const [birthCity, setBirthCity] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  // QA — geolocated city suggestions (Photon/OpenStreetMap, no key). Typed
  // queries go to the public geocoder over HTTPS; picking a row fills the
  // city as "City, Region" and sets the country. Typing free-text still
  // works exactly as before — the suggestions are an offer, not a gate.
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const cityPickedRef = useRef(false);
  const cityReqRef = useRef(0); // only the newest query may commit results
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [needsDate, setNeedsDate] = useState(false);

  const parsed: Date | null = isWeb
    ? parseBirthDate(webDate)
    : birthDateObj
      ? new Date(birthDateObj.getFullYear(), birthDateObj.getMonth(), birthDateObj.getDate(), 12)
      : null;

  const timeString: string | null = isWeb
    ? /^([01]\d|2[0-3]):[0-5]\d$/.test(webTime.trim())
      ? webTime.trim()
      : null
    : birthTimeObj
      ? toHHmm(birthTimeObj)
      : null;

  // Debounced suggestion fetch — quiet on any failure (typing still works).
  useEffect(() => {
    if (cityPickedRef.current) {
      cityPickedRef.current = false;
      return;
    }
    const q = birthCity.trim();
    // Stale offers are worse than none: clear immediately on every change.
    setCitySuggestions([]);
    if (q.length < 3) return;
    const reqId = ++cityReqRef.current;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetchCitySuggestions(q, ctrl.signal)
        .then((s) => {
          if (cityReqRef.current === reqId) setCitySuggestions(s);
        })
        .catch(() => {
          /* offline or blocked — the field stays a plain text input */
        });
    }, 350);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [birthCity]);

  const pickCity = (s: CitySuggestion) => {
    cityPickedRef.current = true;
    setBirthCity(s.label);
    setCitySuggestions([]);
    if (s.countryCode) {
      const match = COUNTRIES.find((c) => c.code === s.countryCode);
      if (match) setCountry(match);
    }
  };

  const leave = () => {
    if (fromOrigin) {
      // Back to the map — with a birth date, the choreography now plays there.
      router.back();
    } else {
      router.push("/onboarding/map");
    }
  };

  const proceed = async (skip = false) => {
    if (saving) return;
    if (skip) {
      leave();
      return;
    }
    if (!parsed) {
      // E1 — the date is required: Continue holds the screen. The only
      // way past without a date is the explicit skip.
      setNeedsDate(true);
      if (!isWeb) {
        setTimeOpen(false);
        setDateOpen(true);
      }
      return;
    }
    setNeedsDate(false);
    setSaving(true);
    setFailed(false);
    try {
      await updateProfile({
        birthDate: Timestamp.fromDate(parsed),
        birthDateISO: toISODate(parsed),
        ...(timeString ? { birthTime: timeString } : {}),
        ...(birthCity.trim() || country
          ? {
              birthPlaceParts: {
                city: birthCity.trim(),
                country: country?.name ?? "",
                countryCode: country?.code ?? "",
              },
            }
          : {}),
      });
      leave();
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  const footerBottom = Math.max(insets.bottom, 20) + 36;

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Content cluster — vertically centered */}
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>YOUR SIGNATURE</Text>
        <Text style={styles.title}>When did you arrive?</Text>
        <Text style={styles.subtitle}>
          This anchors your timing map into your design.
        </Text>

        <View style={styles.fields}>
          {/* Birth date — required. Native wheel; no free-text parsing. */}
          {isWeb ? (
            <TextInput
              style={styles.input}
              placeholder="birth date  (YYYY-MM-DD)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={webDate}
              onChangeText={(t) => setWebDate(formatDigits(t))}
              keyboardType="number-pad"
              maxLength={10}
              returnKeyType="next"
              testID="signature-birthdate"
            />
          ) : (
            <>
              <Pressable
                style={styles.input}
                onPress={() => {
                  setTimeOpen(false);
                  setDateOpen((v) => !v);
                }}
                testID="signature-birthdate"
              >
                <Text style={parsed ? styles.fieldValue : styles.fieldPlaceholder}>
                  {parsed ? toISODate(parsed) : "birth date"}
                </Text>
              </Pressable>
              {dateOpen && (
                <DateTimePicker
                  value={birthDateObj ?? new Date(1990, 0, 1, 12)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event, d) => {
                    if (Platform.OS === "android") setDateOpen(false);
                    if (event.type === "set" && d) setBirthDateObj(d);
                  }}
                  testID="signature-birthdate-wheel"
                />
              )}
            </>
          )}

          {/* QA — founder call: only the birth date ships for now. The time
              and place fields are hidden, not removed — flip the flag to
              bring them back. */}
          {SHOW_EXTENDED_BIRTH_FIELDS && (<>
          {/* Birth time — optional, one-tap skip. */}
          <View style={styles.optionalRow}>
            <Text style={styles.fieldLabel}>Birth time, if you know it</Text>
            {(timeOpen || timeString) && (
              <LinkWhisper
                label="skip"
                onPress={() => {
                  setTimeOpen(false);
                  setBirthTimeObj(null);
                  setWebTime("");
                }}
                testID="signature-time-skip"
              />
            )}
          </View>
          {isWeb ? (
            <TextInput
              style={styles.input}
              placeholder="HH:mm  (optional)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={webTime}
              onChangeText={setWebTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              returnKeyType="next"
              testID="signature-birthtime"
            />
          ) : (
            <>
              <Pressable
                style={styles.input}
                onPress={() => {
                  setDateOpen(false);
                  setTimeOpen((v) => {
                    const next = !v;
                    // QA — the dial's resting value IS the selection: commit
                    // it on open so the field always mirrors the wheel.
                    if (next && !birthTimeObj) setBirthTimeObj(new Date(1990, 0, 1, 12, 0));
                    return next;
                  });
                }}
                testID="signature-birthtime"
              >
                <Text style={timeString ? styles.fieldValue : styles.fieldPlaceholder}>
                  {timeString ?? "—"}
                </Text>
              </Pressable>
              {timeOpen && (
                <DateTimePicker
                  value={birthTimeObj ?? new Date(1990, 0, 1, 12, 0)}
                  mode="time"
                  display="spinner"
                  is24Hour
                  onChange={(event, d) => {
                    // QA — iOS spinners report every tick; take the value as
                    // it moves so the field transfers live. Android keeps the
                    // set/dismiss contract.
                    if (Platform.OS === "android") {
                      setTimeOpen(false);
                      if (event.type === "set" && d) setBirthTimeObj(d);
                    } else if (d) {
                      setBirthTimeObj(d);
                    }
                  }}
                  testID="signature-birthtime-wheel"
                />
              )}
            </>
          )}

          {/* F1 — structured birth place: city text + country picker. Both
              optional; the one-tap skip below covers the whole screen. */}
          {/* H1 — final verbatim label; one field, users may type "Portland, Oregon". */}
          <Text style={styles.fieldLabel}>Birth city, State or Province</Text>
          <View style={styles.cityAnchor}>
          <TextInput
            style={styles.input}
            placeholder="city or town"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={birthCity}
            onChangeText={setBirthCity}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => proceed()}
            testID="signature-birthcity"
          />
          {/* Popover, not in-flow: the form never shifts; it covers the
              fields below only while an offer is open. */}
          {citySuggestions.length > 0 && (
            <View style={styles.suggestList} testID="signature-city-suggestions">
              {citySuggestions.map((s, i) => (
                <Pressable
                  key={`${s.label}-${s.countryCode}-${i}`}
                  style={styles.suggestRow}
                  onPress={() => pickCity(s)}
                  testID={`city-suggestion-${i}`}
                >
                  <Text style={styles.suggestText} numberOfLines={1}>
                    {s.label}
                    {s.countryName ? (
                      <Text style={styles.suggestCountry}>  ·  {s.countryName}</Text>
                    ) : null}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          </View>

          <Text style={styles.fieldLabel}>country</Text>
          <Pressable
            style={styles.input}
            onPress={() => {
              setDateOpen(false);
              setTimeOpen(false);
              setCountryOpen(true);
            }}
            testID="signature-country"
          >
            <Text style={country ? styles.fieldValue : styles.fieldPlaceholder}>
              {country ? country.name : "—"}
            </Text>
          </Pressable>
          </>)}
        </View>

        {failed ? (
          <Text style={styles.failed}>not kept — try again</Text>
        ) : needsDate && !parsed ? (
          <Text style={styles.failed} testID="signature-needs-date">
            the date anchors the map — or skip below
          </Text>
        ) : null}
      </View>

      {/* Skip — quiet, centered, sits above the footer */}
      {!fromOrigin && (
        <View style={[styles.skipWrap, { bottom: footerBottom + 44 }]}>
          <LinkSecondary
            label="skip · add later"
            onPress={() => proceed(true)}
            testID="signature-skip"
          />
        </View>
      )}

      {/* F1 — the country list: static, filtered locally, one tap. */}
      <Modal
        visible={countryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryOpen(false)}
      >
        <View style={styles.countryBackdrop}>
          <View style={[styles.countrySheet, { paddingTop: insets.top + 24 }]}>
            <TextInput
              style={styles.input}
              placeholder="country"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={countryFilter}
              onChangeText={setCountryFilter}
              autoCapitalize="words"
              autoFocus={!isWeb}
              testID="signature-country-filter"
            />
            <ScrollView
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {COUNTRIES.filter((c) =>
                c.name.toLowerCase().includes(countryFilter.trim().toLowerCase())
              ).map((c) => (
                <Pressable
                  key={c.code}
                  style={styles.countryRow}
                  onPress={() => {
                    setCountry(c);
                    setCountryOpen(false);
                    setCountryFilter("");
                  }}
                  testID={`country-${c.code}`}
                >
                  <Text
                    style={
                      country?.code === c.code
                        ? styles.fieldValue
                        : styles.countryName
                    }
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.countryFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {country ? (
                <LinkWhisper
                  label="clear"
                  onPress={() => {
                    setCountry(null);
                    setCountryOpen(false);
                    setCountryFilter("");
                  }}
                  testID="signature-country-clear"
                />
              ) : (
                <View />
              )}
              <LinkSecondary
                label="not now"
                onPress={() => {
                  setCountryOpen(false);
                  setCountryFilter("");
                }}
                testID="signature-country-close"
              />
            </View>
          </View>
        </View>
      </Modal>

      {fromOrigin ? (
        <View style={[styles.originFooter, { bottom: footerBottom }]}>
          <LinkSecondary
            label="not now"
            onPress={() => router.back()}
            testID="signature-cancel"
          />
          <LinkPrimary
            label="save →"
            onPress={() => proceed()}
            disabled={!parsed || saving}
            style={{ opacity: parsed && !saving ? 1 : 0.35 }}
            testID="signature-save"
          />
        </View>
      ) : (
        <OnboardingFooter
          activeIndex={2}
          routes={ONBOARDING_ROUTES}
          onContinue={() => proceed()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: height * 0.1,
    paddingBottom: 140,
    justifyContent: "center",
  },
  eyebrow: {
    ...TypeScale.eyebrow,
    letterSpacing: 2.5,
    color: "#E08AAF",
    marginBottom: 14,
  },
  title: {
    ...TypeScale.serifDisplay,
    color: "rgba(255,255,255,0.96)",
    marginBottom: 10,
  },
  // E1 — the sans subtitle that makes the poetic question legible.
  subtitle: {
    ...TypeScale.bodyLarge,
    color: "rgba(255,255,255,0.58)",
    marginBottom: 28,
  },
  fields: {
    gap: 12,
  },
  fieldLabel: {
    ...TypeScale.metadata,
    letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
    marginBottom: -4,
  },
  optionalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: -4,
  },
  input: {
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    justifyContent: "center",
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
  },
  fieldValue: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.92)",
  },
  fieldPlaceholder: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.5)",
  },
  failed: {
    marginTop: 12,
    ...TypeScale.metadata,
    letterSpacing: 1,
    color: "#E08AAF",
  },
  skipWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  originFooter: {
    position: "absolute",
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // QA — geolocated city suggestions (absolute popover under the city input)
  cityAnchor: {
    position: "relative",
    zIndex: 10,
  },
  suggestList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    backgroundColor: "rgba(10,6,18,0.97)",
    overflow: "hidden",
    zIndex: 10,
    elevation: 10,
  },
  suggestRow: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  suggestText: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.85)",
  },
  suggestCountry: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.45)",
  },

  // F1 — country picker
  countryBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,1,8,0.92)",
  },
  countrySheet: {
    flex: 1,
    paddingHorizontal: 36,
  },
  countryList: {
    flex: 1,
    marginTop: 14,
  },
  countryRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  countryName: {
    ...TypeScale.body,
    color: "rgba(255,255,255,0.72)",
  },
  countryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
});
