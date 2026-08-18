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
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import StockRow from "@/components/StockRow";
import {
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconTrash,
} from "@/components/TabIcon";

type SortKey = "name" | "price" | "change" | "volume";
type SortDir = "asc" | "desc";

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh, lastUpdated, isMarketOpen } = useStocks();
  const { watchlist, removeFromWatchlist, reorder } = useWatchlist();
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editMode, setEditMode] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setManualRefreshing(false);
    }
  }, [refresh]);

  const handleSort = (key: SortKey) => {
    if (editMode) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const listData = editMode
    ? watchlist
    : [...watchlist].sort((a, b) => {
        const qa = quotes[a];
        const qb = quotes[b];
        let va = 0, vb = 0;
        if (sortKey === "name") {
          const c = a.localeCompare(b);
          return sortDir === "asc" ? c : -c;
        }
        if (sortKey === "price") { va = qa?.regularMarketPrice ?? 0; vb = qb?.regularMarketPrice ?? 0; }
        if (sortKey === "change") { va = qa?.regularMarketChangePercent ?? 0; vb = qb?.regularMarketChangePercent ?? 0; }
        if (sortKey === "volume") { va = qa?.regularMarketVolume ?? 0; vb = qb?.regularMarketVolume ?? 0; }
        return sortDir === "asc" ? va - vb : vb - va;
      });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const upCount = watchlist.filter((s) => (quotes[s]?.regularMarketChangePercent ?? 0) > 0).length;
  const downCount = watchlist.filter((s) => (quotes[s]?.regularMarketChangePercent ?? 0) < 0).length;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const handleMove = useCallback((symbol: string, direction: -1 | 1) => {
    const from = watchlist.indexOf(symbol);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= watchlist.length) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    reorder(from, to);
  }, [watchlist, reorder]);

  const handleRemove = useCallback((symbol: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromWatchlist(symbol);
  }, [removeFromWatchlist]);

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

  const renderRightActions = (symbol: string) => (
    <Pressable
      style={[styles.swipeDelete, { backgroundColor: colors.down }]}
      onPress={() => handleRemove(symbol)}
    >
      <IconTrash color="#fff" size={18} />
      <Text style={styles.swipeDeleteText}>Sil</Text>
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
            <Text style={[styles.headerHint, { color: colors.mutedForeground }]}>Yıldız: Favoriler · Düzenle: Piyasa listesi</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {Object.keys(quotes).length > 0 && !editMode && (
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
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            hitSlop={10}
            style={[styles.editBtn, { backgroundColor: editMode ? `${colors.primary}20` : colors.secondary }]}
          >
            <Text style={[styles.editBtnText, { color: editMode ? colors.primary : colors.mutedForeground }]}>
              {editMode ? "Tamam" : "Düzenle"}
            </Text>
          </Pressable>
          {!editMode && (
            <Pressable onPress={handleManualRefresh} hitSlop={12} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
              <IconRefresh color={colors.mutedForeground} size={14} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sort row */}
      {!editMode && (
        <View style={[styles.sortRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <SortBtn label="Sembol" k="name" />
          <View style={styles.spacer} />
          <SortBtn label="Hacim" k="volume" />
          <SortBtn label="Fiyat" k="price" />
          <SortBtn label="Değişim" k="change" />
          <View style={{ width: 28 }} />
        </View>
      )}
      {editMode && (
        <View style={[styles.editHint, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.editHintText, { color: colors.mutedForeground }]}>
            Sıralamak için ok tuşlarını kullanın, silmek için sola kaydırın
          </Text>
        </View>
      )}

      {loading && Object.keys(quotes).length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Veriler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item}
          renderItem={({ item, index }) =>
            editMode ? (
              <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
                <View style={[styles.rowWrap, { backgroundColor: colors.card }]}>
                  <View style={styles.rowFlex}>
                    <StockRow symbol={item} quote={quotes[item]} showFavoriteBtn={false} />
                  </View>
                  <View style={styles.reorderBtns}>
                    <Pressable
                      onPress={() => handleMove(item, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                      style={styles.reorderBtn}
                    >
                      <IconArrowUp color={index === 0 ? colors.border : colors.mutedForeground} size={16} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMove(item, 1)}
                      disabled={index === listData.length - 1}
                      hitSlop={6}
                      style={styles.reorderBtn}
                    >
                      <IconArrowDown color={index === listData.length - 1 ? colors.border : colors.mutedForeground} size={16} />
                    </Pressable>
                  </View>
                </View>
              </Swipeable>
            ) : (
              <StockRow symbol={item} quote={quotes[item]} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={manualRefreshing}
              onRefresh={handleManualRefresh}
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
  headerHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketSummary: { flexDirection: "row", gap: 8 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryArrow: { fontSize: 9 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  editHint: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editHintText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowWrap: { flexDirection: "row", alignItems: "center" },
  rowFlex: { flex: 1 },
  reorderBtns: { flexDirection: "column", paddingHorizontal: 10, gap: 6 },
  reorderBtn: { padding: 2 },
  swipeDelete: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
