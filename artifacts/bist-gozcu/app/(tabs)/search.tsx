import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { UNIQUE_BIST_STOCKS, StockMeta } from "@/constants/bistStocks";
import { fetchSingleQuote } from "@/utils/yahooFinance";
import StockRow from "@/components/StockRow";
import { IconSearch, IconX } from "@/components/TabIcon";

const SECTORS = Array.from(new Set(UNIQUE_BIST_STOCKS.map((s) => s.sector))).sort();

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes } = useStocks();
  const [query, setQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [remoteResult, setRemoteResult] = useState<{ meta: StockMeta; quote: Awaited<ReturnType<typeof fetchSingleQuote>> } | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);

  const results = useMemo<StockMeta[]>(() => {
    const q = query.trim().toUpperCase();
    return UNIQUE_BIST_STOCKS.filter((s) => {
      const matchQuery =
        q === "" ||
        s.symbol.includes(q) ||
        s.name.toUpperCase().includes(q) ||
        s.sector.toUpperCase().includes(q);
      const matchSector = selectedSector == null || s.sector === selectedSector;
      return matchQuery && matchSector;
    });
  }, [query, selectedSector]);

  useEffect(() => {
    const q = query.trim().toUpperCase();
    setRemoteResult(null);
    setRemoteError(false);
    if (selectedSector != null || q.length < 3 || results.length > 0) {
      setRemoteLoading(false);
      return;
    }

    let active = true;
    setRemoteLoading(true);
    const timer = setTimeout(() => {
      void fetchSingleQuote(q).then((quote) => {
        if (!active) return;
        if (quote) {
          setRemoteResult({
            quote,
            meta: { symbol: q, name: quote.shortName || q, sector: "Harici sembol" },
          });
        } else {
          setRemoteError(true);
        }
      }).catch(() => {
        if (active) setRemoteError(true);
      }).finally(() => {
        if (active) setRemoteLoading(false);
      });
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedSector, results.length]);

  const displayedResults = remoteResult ? [remoteResult.meta, ...results] : results;

  const handleFavoriteAdded = useCallback((symbol: string) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddedMsg(`${symbol} favorilere eklendi`);
    setTimeout(() => setAddedMsg(null), 2000);
  }, []);

  const handleSector = useCallback((sector: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedSector((prev) => (prev === sector ? null : sector));
  }, []);

  const clearSearch = () => {
    setQuery("");
    setSelectedSector(null);
  };

  const renderItem = useCallback(({ item }: { item: StockMeta }) => (
    <StockRow
      symbol={item.symbol}
      quote={item.symbol === remoteResult?.meta.symbol ? (remoteResult.quote ?? undefined) : quotes[item.symbol]}
      showFavoriteBtn
      onFavoriteAdded={handleFavoriteAdded}
    />
  ), [quotes, remoteResult, handleFavoriteAdded]);

  const hasFilter = query.length > 0 || selectedSector != null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 10 }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Ara</Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: query.length > 0 ? colors.primary : colors.border }]}>
        <IconSearch color={colors.mutedForeground} size={17} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Hisse kodu veya şirket adı..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
        />
        {hasFilter && (
          <Pressable onPress={clearSearch} hitSlop={8} style={[styles.clearBtn, { backgroundColor: colors.secondary }]}>
            <IconX color={colors.mutedForeground} size={13} />
          </Pressable>
        )}
      </View>

      {/* Toast */}
      {addedMsg && (
        <View style={[styles.toast, { backgroundColor: colors.up }]}>
          <Text style={styles.toastText}>✓ {addedMsg}</Text>
        </View>
      )}

      {/* Sector chips */}
      <FlatList
        data={SECTORS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s}
        style={[styles.sectorRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 6 }}
        renderItem={({ item }) => {
          const active = selectedSector === item;
          return (
            <Pressable
              style={[
                styles.sectorChip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSector(item)}
            >
              <Text style={[styles.sectorText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Count + clear */}
      <View style={[styles.countBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {displayedResults.length} hisse
          {selectedSector ? ` · ${selectedSector}` : ""}
          {query.length > 0 ? ` · "${query}"` : ""}
        </Text>
        {hasFilter && (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <Text style={[styles.clearAllText, { color: colors.primary }]}>Temizle</Text>
          </Pressable>
        )}
      </View>

      {/* Results */}
      <FlatList
        data={displayedResults}
        keyExtractor={(item) => item.symbol}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              {remoteLoading ? "Hisse doğrulanıyor…" : remoteError ? "Hisse bulunamadı" : "Sonuç bulunamadı"}
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {remoteLoading ? `"${query}" veri kaynağında kontrol ediliyor` : remoteError ? `"${query}" için doğrulanabilir piyasa verisi bulunamadı` : `"${query}" için eşleşme yok`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderWidth: 1,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  clearBtn: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  toast: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  sectorRow: { height: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
  sectorChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
  },
  sectorText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  clearAllText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", marginTop: 60, gap: 6 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
