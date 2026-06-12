import React, { useState, useMemo, useCallback } from "react";
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
import { useFavorites } from "@/contexts/FavoritesContext";
import { ALL_BIST_STOCKS, StockMeta } from "@/constants/bistStocks";
import StockRow from "@/components/StockRow";
import { IconSearch } from "@/components/TabIcon";

const SECTORS = Array.from(new Set(ALL_BIST_STOCKS.map((s) => s.sector))).sort();

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes } = useStocks();
  const { addFavorite, isFavorite } = useFavorites();
  const [query, setQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  const results = useMemo<StockMeta[]>(() => {
    const q = query.trim().toUpperCase();
    return ALL_BIST_STOCKS.filter((s) => {
      const matchQuery =
        q === "" ||
        s.symbol.includes(q) ||
        s.name.toUpperCase().includes(q) ||
        s.sector.toUpperCase().includes(q);
      const matchSector = selectedSector == null || s.sector === selectedSector;
      return matchQuery && matchSector;
    });
  }, [query, selectedSector]);

  const handleAddToWatchlist = useCallback((symbol: string) => {
    if (!isFavorite(symbol)) {
      addFavorite(symbol);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedMsg(`${symbol} favorilere eklendi`);
      setTimeout(() => setAddedMsg(null), 2000);
    }
  }, [isFavorite, addFavorite]);

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
      quote={quotes[item.symbol]}
      showFavoriteBtn
      onAddToWatchlist={handleAddToWatchlist}
    />
  ), [quotes, handleAddToWatchlist]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <IconSearch color={colors.mutedForeground} size={18} />
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
        {(query.length > 0 || selectedSector != null) && (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <Text style={[styles.clearX, { color: colors.mutedForeground }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Toast */}
      {addedMsg && (
        <View style={[styles.toast, { backgroundColor: colors.up }]}>
          <Text style={styles.toastText}>{addedMsg}</Text>
        </View>
      )}

      {/* Sector chips */}
      <FlatList
        data={SECTORS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s}
        style={[styles.sectorRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.sectorChip,
              {
                backgroundColor: selectedSector === item ? colors.primary : colors.card,
                borderColor: selectedSector === item ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleSector(item)}
          >
            <Text style={[
              styles.sectorText,
              { color: selectedSector === item ? "#fff" : colors.mutedForeground },
            ]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      {/* Count bar */}
      <View style={[styles.countBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {results.length} hisse{selectedSector ? ` · ${selectedSector}` : ""}
          {query.length > 0 ? ` · "${query}"` : ""}
        </Text>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.symbol}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              Sonuç bulunamadı
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              "{query}" için eşleşme yok
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 7,
    borderWidth: 1,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  clearX: { fontSize: 14, paddingHorizontal: 2 },
  toast: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  sectorRow: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
  sectorChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectorText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countBar: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", marginTop: 60, gap: 6 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
