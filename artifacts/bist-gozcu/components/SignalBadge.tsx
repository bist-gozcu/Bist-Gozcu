import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Signal } from "@/utils/indicators";

interface SignalBadgeProps {
  signal: Signal;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export default function SignalBadge({ signal, size = "md", showIcon = true }: SignalBadgeProps) {
  const colors = useColors();

  const config = {
    buy: { label: "AL", color: colors.up, icon: "trending-up" as const },
    sell: { label: "SAT", color: colors.down, icon: "trending-down" as const },
    neutral: { label: "BEKLE", color: colors.neutral, icon: "minus" as const },
  };

  const { label, color, icon } = config[signal];
  const isSmall = size === "sm";

  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      {showIcon && <Feather name={icon} size={isSmall ? 10 : 12} color={color} />}
      <Text style={[styles.label, { color, fontSize: isSmall ? 10 : 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
