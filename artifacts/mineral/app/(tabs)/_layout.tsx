import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import TabIcon from "@/components/TabIcon";
import { TypeScale } from "@/constants/typography";

// Mineral uses classic Tabs (no NativeTabs) so we can fully control the
// dark atmospheric tab bar styling. NativeTabs would override to system chrome.

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabBarHeight = isWeb ? 84 : 60 + insets.bottom;

  return (
    <Tabs
      // §1 — the Origin map is Mineral's primary daily surface.
      initialRouteName="origin"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          ...TypeScale.metadata,
          fontSize: 10,
          marginBottom: isIOS ? 0 : 4,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 34 : insets.bottom,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(10, 5, 16, 0.92)",
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "today",
          tabBarIcon: ({ color }) => (
            <TabIcon name="today" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "notes",
          tabBarIcon: ({ color }) => (
            <TabIcon name="notes" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          title: "guide",
          tabBarIcon: ({ color }) => (
            <TabIcon name="guide" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="origin"
        options={{
          title: "origin",
          tabBarIcon: ({ color }) => (
            <TabIcon name="origin" color={color} size={18} />
          ),
        }}
      />
    </Tabs>
  );
}
