import React, { useState, useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { ALL_BIST_STOCKS, StockMeta } from "@/constants/bistStocks";
import StockRow from "@/components/StockRow";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes } = useStocks();
  const { addFavorite, isFavorite } = useFavorites();
  const [query, setQuery] = useState("");
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  const results = useMemo<StockMeta[]>(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 1) return [];
    return ALL_BIST_STOCKS.filter(
      (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q) || s.sector.toUpperCase().includes(q)
    ).slice(0, 40);
  }, [query]);

  const handleAddToWatchlist = (symbol: string) => {
    if (!isFavorite(symbol)) {
      addFavorite(symbol);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedMsg(`${symbol} favorilere eklendi`);
      setTimeout(() => setAddedMsg(null), 2000);
    }
  };

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Hisse kodu veya şirket adı..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {addedMsg && (
        <View style={[styles.toast, { backgroundColor: colors.up }]}>
          <Text style={styles.toastText}>{addedMsg}</Text>
        </View>
      )}

      {query.length === 0 ? (
        <View style={styles.hint}>
          <Feather name="search" size={36} color={colors.border} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            BIST'teki tüm hisseleri arayın
          </Text>
          <Text style={[styles.hintSub, { color: colors.mutedForeground }]}>
            Sembol, şirket adı veya sektör ile arama yapabilirsiniz
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.hint}>
          <Feather name="alert-circle" size={36} color={colors.border} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Sonuç bulunamadı
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <View>
              <StockRow
                symbol={item.symbol}
                quote={quotes[item.symbol]}
                showFavoriteBtn
                onAddToWatchlist={handleAddToWatchlist}
              />
              <View style={[styles.sectorTag, { borderBottomColor: colors.border }]}>
                <View style={[styles.chip, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.sector}</Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingVertical: 10,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  hint: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  hintText: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  hintSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectorTag: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  toast: {
    marginHorizontal: 12,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
