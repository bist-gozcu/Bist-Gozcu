import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { BIST30 } from "@/constants/bistStocks";
import StockRow from "@/components/StockRow";

type SortKey = "name" | "price" | "change" | "volume";
type SortDir = "asc" | "desc";

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh, lastUpdated, isMarketOpen } = useStocks();
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...BIST30].sort((a, b) => {
    const qa = quotes[a.symbol];
    const qb = quotes[b.symbol];
    let va = 0, vb = 0;
    if (sortKey === "name") {
      va = a.symbol.localeCompare(b.symbol);
      vb = 0;
      return sortDir === "asc" ? va : -va;
    }
    if (sortKey === "price") { va = qa?.regularMarketPrice ?? 0; vb = qb?.regularMarketPrice ?? 0; }
    if (sortKey === "change") { va = qa?.regularMarketChangePercent ?? 0; vb = qb?.regularMarketChangePercent ?? 0; }
    if (sortKey === "volume") { va = qa?.regularMarketVolume ?? 0; vb = qb?.regularMarketVolume ?? 0; }
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const topPaddingStyle = Platform.OS === "web"
    ? { paddingTop: insets.top + 10 }
    : {};

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <Pressable onPress={() => handleSort(k)} style={styles.sortBtn}>
      <Text style={[styles.sortLabel, { color: sortKey === k ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
      {sortKey === k && (
        <Feather
          name={sortDir === "desc" ? "chevron-down" : "chevron-up"}
          size={11}
          color={colors.primary}
        />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      <View style={[styles.statusBar, { borderBottomColor: colors.border }]}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: isMarketOpen ? colors.up : colors.mutedForeground }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {isMarketOpen ? "Borsa Açık" : "Borsa Kapalı"}
          </Text>
          {lastUpdated && (
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              {" • "}{formatTime(lastUpdated)}
            </Text>
          )}
        </View>
        <Pressable onPress={refresh} hitSlop={8}>
          <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={[styles.sortRow, { borderBottomColor: colors.border }]}>
        <SortBtn label="Sembol" k="name" />
        <View style={styles.spacer} />
        <SortBtn label="Hacim" k="volume" />
        <SortBtn label="Fiyat" k="price" />
        <SortBtn label="Değişim" k="change" />
        <View style={{ width: 28 }} />
      </View>

      {loading && Object.keys(quotes).length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item, index }) => (
            <StockRow
              symbol={item.symbol}
              quote={quotes[item.symbol]}
              rank={index + 1}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4 },
  sortLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  spacer: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
