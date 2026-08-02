import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { LinkPrimary } from "@/components/Links";
import { TypeScale } from "@/constants/typography";
import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          This screen doesn&apos;t exist.
        </Text>

        <LinkPrimary
          label="Go to home screen!"
          onPress={() => router.replace("/")}
          noArrow
          color={colors.primary}
          style={styles.link}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    ...TypeScale.screenTitle,
  },
  link: {
    marginTop: 15,
    alignSelf: "center",
  },
});
