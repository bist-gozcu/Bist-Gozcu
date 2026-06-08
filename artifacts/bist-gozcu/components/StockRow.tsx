import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StockQuote } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getStockMeta } from "@/constants/bistStocks";

interface StockRowProps {
  symbol: string;
  quote?: StockQuote;
  rank?: number;
  showFavoriteBtn?: boolean;
  onAddToWatchlist?: (symbol: string) => void;
}

export default function StockRow({
  symbol,
  quote,
  rank,
  showFavoriteBtn = true,
  onAddToWatchlist,
}: StockRowProps) {
  const colors = useColors();
  const router = useRouter();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const meta = getStockMeta(symbol);
  const fav = isFavorite(symbol);

  const price = quote?.regularMarketPrice;
  const change = quote?.regularMarketChangePercent;
  const volume = quote?.regularMarketVolume;

  const changeColor =
    change == null ? colors.mutedForeground :
    change > 0 ? colors.up :
    change < 0 ? colors.down :
    colors.neutral;

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push({ pathname: "/stock/[symbol]", params: { symbol } });
  };

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol);
    else {
      addFavorite(symbol);
      onAddToWatchlist?.(symbol);
    }
  };

  const formatVolume = (v?: number) => {
    if (!v) return "—";
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}Mr`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.accent : colors.card, borderBottomColor: colors.border },
      ]}
      onPress={handlePress}
    >
      {rank != null && (
        <Text style={[styles.rank, { color: colors.mutedForeground }]}>{rank}</Text>
      )}
      <View style={styles.info}>
        <Text style={[styles.symbol, { color: colors.foreground }]}>{symbol}</Text>
        <Text style={[styles.name, { color: colors.mutedForeground }]} numberOfLines={1}>
          {meta?.name ?? symbol}
        </Text>
      </View>
      <View style={styles.volBox}>
        <Text style={[styles.vol, { color: colors.mutedForeground }]}>{formatVolume(volume)}</Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={[styles.price, { color: colors.foreground }]}>
          {price != null ? `₺${price.toFixed(2)}` : "—"}
        </Text>
        {change != null && (
          <View style={[styles.changePill, { backgroundColor: `${changeColor}22` }]}>
            <Text style={[styles.changeText, { color: changeColor }]}>
              {change > 0 ? "+" : ""}{change.toFixed(2)}%
            </Text>
          </View>
        )}
      </View>
      {showFavoriteBtn && (
        <Pressable onPress={handleFav} hitSlop={8} style={styles.starBtn}>
          <Feather
            name={fav ? "star" : "star"}
            size={18}
            color={fav ? colors.neutral : colors.mutedForeground}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 24, fontSize: 12, fontFamily: "Inter_400Regular" },
  info: { flex: 1, marginRight: 8 },
  symbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  name: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  volBox: { marginRight: 12 },
  vol: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priceBox: { alignItems: "flex-end", minWidth: 80 },
  price: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  changePill: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  starBtn: { marginLeft: 10 },
});
