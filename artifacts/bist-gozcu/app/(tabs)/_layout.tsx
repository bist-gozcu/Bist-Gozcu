import { Tabs } from "expo-router";
import React from "react";
import { Platform, View, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";
import { useAlerts } from "@/contexts/AlertContext";
import {
  IconBarChart,
  IconStar,
  IconBriefcase,
  IconSearch,
  IconBell,
} from "@/components/TabIcon";

function TabBadge({ count }: { count: number }) {
  const colors = useColors();
  if (count === 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.down }]}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { triggeredAlerts } = useAlerts();
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
        name="portfolio"
        options={{
          title: "Portföy",
          tabBarLabel: "Portföy",
          tabBarIcon: ({ color }) => <IconBriefcase color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Ara",
          tabBarLabel: "Ara",
          tabBarIcon: ({ color }) => <IconSearch color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alarmlar",
          tabBarLabel: "Alarmlar",
          tabBarIcon: ({ color }) => (
            <View>
              <IconBell color={color} size={22} />
              <TabBadge count={triggeredAlerts.length} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
});
