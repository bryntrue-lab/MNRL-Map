import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { TypeScale } from "@/constants/typography";
import { ArchaicAtmosphere } from "@/components/Atmosphere";
import { LinkSecondary } from "@/components/Links";
import OnboardingFooter from "@/components/OnboardingFooter";
import { useAuth } from "@/context/AuthContext";

const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/entry",
  "/onboarding/signature",
  "/onboarding/map",
  "/onboarding/practice",
  "/onboarding/begin",
];

const { width, height } = Dimensions.get("window");

// The Mineral wordmark — Radiometry, white, with triangular A
function MineralWordmark({ w = 250 }: { w?: number }) {
  const h = w * (52.05 / 259.2);
  return (
    <Svg viewBox="0 0 259.2 52.05" width={w} height={h} fill="white">
      <Path d="M204.24,52.05l-9.16-17.02-6.63,14.82h-5.98L204.37.73l22.22,49.12h-5.98l-6.69-14.82-9.68,17.02ZM204.37,14.02l-6.5,14.65,6.5,11.94,6.69-11.94-6.69-14.65Z" />
      <Path d="M42.64.13v49.88h-5.5v-28.49l-15.82,28.71L5.5,21.52v28.49H0V.13l21.32,38.69L42.64.13Z" />
      <Path d="M49.82,50.01V.5h5.5v49.5h-5.5Z" />
      <Path d="M98.95.5v50.02l-30.95-35.76v35.24h-5.5V0l30.95,35.76V.5h5.5Z" />
      <Path d="M111.63,6.01v16.51h20.52v5.5h-20.52v16.49h23.96v5.5h-29.46V.51h29.46v5.5h-23.96Z" />
      <Path d="M178.31,50.01h-6.68l-15.14-22h-8.22v21.99h-5.5V.5h19.26c7.39-.02,13.46,5.81,13.76,13.19s-5.29,13.68-12.65,14.26l15.18,22.05ZM162.03,22.51c3,.08,5.8-1.48,7.32-4.06,1.52-2.58,1.52-5.79,0-8.38-1.52-2.58-4.33-4.14-7.32-4.06h-13.75v16.5h13.75Z" />
      <Path d="M259.2,44.5v5.5h-27.51V.5h5.5v44h22.01Z" />
    </Svg>
  );
}

export default function HelloScreen() {
  const { user, signInAnon } = useAuth();

  // Amendment B — after an explicit sign-out, begin starts a fresh
  // anonymous session before the six steps.
  const begin = async () => {
    if (!user) {
      try {
        await signInAnon();
      } catch {
        return; // stay on hello — tapping begin retries
      }
    }
    router.push("/onboarding/entry");
  };

  return (
    <View style={styles.container}>
      <ArchaicAtmosphere />

      {/* Wordmark + tagline — vertically centered with footer offset */}
      <View style={styles.centerContent}>
        <MineralWordmark w={width * 0.72} />
        <Text style={styles.tagline}>a practice for the creative psyche</Text>
      </View>

      {/* C.1 §1h — the way back into an existing field */}
      <LinkSecondary
        label="already keeping a field? sign in"
        onPress={() => router.push("/onboarding/signin")}
        style={styles.signInLine}
        testID="hello-sign-in"
      />

      <OnboardingFooter
        activeIndex={0}
        routes={ONBOARDING_ROUTES}
        onContinue={begin}
        continueLabel="begin →"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050208",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: height * 0.15,
    paddingBottom: 0,
  },
  signInLine: {
    alignSelf: "center",
    marginBottom: 4,
  },
  tagline: {
    ...TypeScale.serifSmall,
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    marginTop: 22,
  },
});
