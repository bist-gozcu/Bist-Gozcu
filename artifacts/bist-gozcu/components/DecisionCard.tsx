// Dosya: components/DecisionCard.tsx

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface DecisionCardProps {
  sembol: string;
  skor: number;
  guncelFiyat: number;
  hedefFiyat?: number;
  stopFiyat?: number;
  etiket?: string;
}

export default function DecisionCard({
  sembol,
  skor,
  guncelFiyat,
  hedefFiyat,
  stopFiyat,
  etiket = "TAKİP LİSTESİ",
}: DecisionCardProps) {
  const colors = useColors();
  const hasProximityBar =
    hedefFiyat !== undefined &&
    stopFiyat !== undefined &&
    hedefFiyat > stopFiyat &&
    guncelFiyat !== 0;

  const progress = hasProximityBar
    ? Math.min(
        100,
        Math.max(
          0,
          ((guncelFiyat - (stopFiyat as number)) /
            ((hedefFiyat as number) - (stopFiyat as number))) *
            100,
        ),
      )
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{sembol}</Text>
          <Text style={[styles.price, { color: colors.mutedForeground }]}>
            ₺{guncelFiyat.toFixed(2)}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.label, { color: colors.primary }]}>{etiket}</Text>
          <Text style={[styles.score, { color: colors.foreground }]}>
            {skor.toFixed(2)}
          </Text>
        </View>
      </View>

      {progress !== null && (
        <View style={styles.proximity}>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.levels}>
            <Text style={[styles.level, { color: colors.down }]}>SL ₺{stopFiyat?.toFixed(2)}</Text>
            <Text style={[styles.level, { color: colors.up }]}>TP ₺{hedefFiyat?.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { fontSize: 16, fontFamily: "Inter_700Bold" },
  price: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  scoreBox: { alignItems: "flex-end" },
  label: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  score: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 },
  proximity: { gap: 6 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  levels: { flexDirection: "row", justifyContent: "space-between" },
  level: { fontSize: 10, fontFamily: "Inter_500Medium" },
});