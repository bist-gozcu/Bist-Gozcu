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
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { BIST30 } from "@/constants/bistStocks";
import StockRow from "@/components/StockRow";
import {
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
} from "@/components/TabIcon";

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
      const c = a.symbol.localeCompare(b.symbol);
      return sortDir === "asc" ? c : -c;
    }
    if (sortKey === "price") { va = qa?.regularMarketPrice ?? 0; vb = qb?.regularMarketPrice ?? 0; }
    if (sortKey === "change") { va = qa?.regularMarketChangePercent ?? 0; vb = qb?.regularMarketChangePercent ?? 0; }
    if (sortKey === "volume") { va = qa?.regularMarketVolume ?? 0; vb = qb?.regularMarketVolume ?? 0; }
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const upCount = BIST30.filter((s) => (quotes[s.symbol]?.regularMarketChangePercent ?? 0) > 0).length;
  const downCount = BIST30.filter((s) => (quotes[s.symbol]?.regularMarketChangePercent ?? 0) < 0).length;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <Pressable onPress={() => handleSort(k)} style={styles.sortBtn}>
      <Text style={[styles.sortLabel, { color: sortKey === k ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
      {sortKey === k && (
        sortDir === "desc"
          ? <IconChevronDown color={colors.primary} size={11} />
          : <IconChevronUp color={colors.primary} size={11} />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Piyasa</Text>
          <View style={styles.headerSub}>
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
        </View>
        <View style={styles.headerRight}>
          {Object.keys(quotes).length > 0 && (
            <View style={styles.marketSummary}>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryNum, { color: colors.up }]}>{upCount}</Text>
                <Text style={[styles.summaryArrow, { color: colors.up }]}>▲</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryNum, { color: colors.down }]}>{downCount}</Text>
                <Text style={[styles.summaryArrow, { color: colors.down }]}>▼</Text>
              </View>
            </View>
          )}
          <Pressable onPress={refresh} hitSlop={12} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
            <IconRefresh color={colors.mutedForeground} size={14} />
          </Pressable>
        </View>
      </View>

      {/* Sort row */}
      <View style={[styles.sortRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <SortBtn label="Sembol" k="name" />
        <View style={styles.spacer} />
        <SortBtn label="Hacim" k="volume" />
        <SortBtn label="Fiyat" k="price" />
        <SortBtn label="Değişim" k="change" />
        <View style={{ width: 28 }} />
      </View>

      {loading && Object.keys(quotes).length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Veriler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <StockRow
              symbol={item.symbol}
              quote={quotes[item.symbol]}
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
          ItemSeparatorComponent={() => null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketSummary: { flexDirection: "row", gap: 8 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryArrow: { fontSize: 9 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4 },
  sortLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  spacer: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
