import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StockQuote } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getStockMeta } from "@/constants/bistStocks";
import { IconStar } from "@/components/TabIcon";

type SignalDir = "buy" | "sell" | "neutral";

function getSignal(quote?: StockQuote): SignalDir {
  if (!quote) return "neutral";
  const change = quote.regularMarketChangePercent ?? 0;
  const price  = quote.regularMarketPrice ?? 0;
  const open   = quote.regularMarketOpen ?? price;
  const high   = quote.regularMarketDayHigh ?? price;
  const low    = quote.regularMarketDayLow ?? price;
  const prev   = quote.regularMarketPreviousClose ?? price;

  let score = 0;

  if (change > 2) score += 2;
  else if (change > 0.5) score += 1;
  else if (change < -2) score -= 2;
  else if (change < -0.5) score -= 1;

  if (price > prev * 1.005) score += 1;
  else if (price < prev * 0.995) score -= 1;

  const bodyRatio = Math.abs(price - open) / (high - low || 1);
  const isBull = price >= open;
  const lowerWick = Math.min(price, open) - low;
  const upperWick = high - Math.max(price, open);
  if (isBull && lowerWick > Math.abs(price - open) * 1.5) score += 1;
  if (!isBull && upperWick > Math.abs(price - open) * 1.5) score -= 1;
  if (bodyRatio > 0.6 && isBull) score += 1;
  if (bodyRatio > 0.6 && !isBull) score -= 1;

  if (score >= 2) return "buy";
  if (score <= -2) return "sell";
  return "neutral";
}

function SignalArrow({ direction, color }: { direction: SignalDir; color: string }) {
  const size = 14;
  if (direction === "buy") {
    return (
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Polygon points="7,1 13,13 1,13" fill={color} />
      </Svg>
    );
  }
  if (direction === "sell") {
    return (
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Polygon points="7,13 13,1 1,1" fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Polygon points="1,5 13,5 13,9 1,9" fill={color} />
      <Polygon points="10,1 14,7 10,13" fill={color} />
    </Svg>
  );
}

interface StockRowProps {
  symbol: string;
  quote?: StockQuote;
  showFavoriteBtn?: boolean;
  onAddToWatchlist?: (symbol: string) => void;
}

export default function StockRow({
  symbol,
  quote,
  showFavoriteBtn = true,
  onAddToWatchlist,
}: StockRowProps) {
  const colors = useColors();
  const router = useRouter();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const meta = getStockMeta(symbol);
  const fav = isFavorite(symbol);

  const price  = quote?.regularMarketPrice;
  const change = quote?.regularMarketChangePercent;
  const volume = quote?.regularMarketVolume;
  const signal = getSignal(quote);

  const changeColor =
    change == null ? colors.mutedForeground :
    change > 0     ? colors.up :
    change < 0     ? colors.down :
                     colors.neutral;

  const signalColor =
    signal === "buy"  ? colors.up :
    signal === "sell" ? colors.down :
                        colors.neutral;

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.push({ pathname: "/stock/[symbol]", params: { symbol } });
  };

  const handleFav = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol);
    else {
      addFavorite(symbol);
      onAddToWatchlist?.(symbol);
    }
  };

  const formatVolume = (v?: number) => {
    if (!v) return "—";
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}Mr`;
    if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.accent : colors.card,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={handlePress}
    >
      {/* Signal arrow */}
      <View style={styles.arrowBox}>
        {quote ? (
          <SignalArrow direction={signal} color={signalColor} />
        ) : (
          <View style={[styles.arrowPlaceholder, { backgroundColor: colors.border }]} />
        )}
      </View>

      {/* Name */}
      <View style={styles.info}>
        <Text
          style={[styles.symbol, { color: colors.foreground }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {symbol}
        </Text>
        <Text
          style={[styles.name, { color: colors.mutedForeground }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {meta?.name ?? symbol}
        </Text>
      </View>

      {/* Volume */}
      <View style={styles.volBox}>
        <Text style={[styles.vol, { color: colors.mutedForeground }]}>
          {formatVolume(volume)}
        </Text>
      </View>

      {/* Price + change */}
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

      {/* Star */}
      {showFavoriteBtn && (
        <Pressable
          onPress={handleFav}
          hitSlop={8}
          style={styles.starBtn}
          accessibilityRole="button"
          accessibilityLabel={`${symbol} ${fav ? "favorilerden çıkar" : "favorilere ekle"}`}
          testID={`favorite-${symbol}`}
        >
          <IconStar size={18} color={fav ? colors.neutral : colors.mutedForeground} filled={fav} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrowBox: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  arrowPlaceholder: { width: 8, height: 8, borderRadius: 4 },
  info: { flex: 1, marginRight: 6, minWidth: 0 },
  symbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  name: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  volBox: { marginRight: 10, minWidth: 44, alignItems: "flex-end" },
  vol: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priceBox: { alignItems: "flex-end", minWidth: 78 },
  price: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  changePill: {
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  starBtn: { marginLeft: 8 },
});
