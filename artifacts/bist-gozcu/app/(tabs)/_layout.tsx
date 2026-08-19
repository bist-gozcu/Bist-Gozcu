import { Tabs } from "expo-router";
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";
import {
  IconBarChart,
  IconStar,
  IconSearch,
  IconTrendingUp,
} from "@/components/TabIcon";



export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "Inter_700Bold", fontSize: 17 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: Platform.OS === "web" ? 64 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginBottom: Platform.OS === "android" ? 4 : 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Piyasa",
          tabBarLabel: "Piyasa",
          tabBarIcon: ({ color }) => <IconBarChart color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoriler",
          tabBarLabel: "Favoriler",
          tabBarIcon: ({ color, focused }) => <IconStar color={color} size={22} filled={focused} />,
        }}
      />
      <Tabs.Screen
        name="treyd"
        options={{
          title: "Treyd",
          tabBarLabel: "Treyd",
          tabBarIcon: ({ color }) => <IconTrendingUp color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Ara",
          tabBarLabel: "Ara",
          tabBarIcon: ({ color }) => <IconSearch color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}