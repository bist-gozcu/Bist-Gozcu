import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { fetchMacroQuotes, fetchMarketNews, MarketNews, QuoteData } from "@/utils/yahooFinance";
import { IconRefresh } from "@/components/TabIcon";

type MacroAsset = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  sourceSymbol?: string;
  derived?: "goldGram" | "silverGram";
};

const TROY_OUNCE_GRAMS = 31.1034768;
const MACRO_SOURCE_SYMBOLS = ["USDTRY=X", "EURTRY=X", "GC=F", "SI=F", "XU030.IS", "XU050.IS", "XU100.IS"];

const MACRO_ASSETS: MacroAsset[] = [
  { key: "USDTRY=X", label: "Dolar / TL", unit: "₺", decimals: 4, sourceSymbol: "USDTRY=X" },
  { key: "EURTRY=X", label: "Euro / TL", unit: "₺", decimals: 4, sourceSymbol: "EURTRY=X" },
  { key: "GC=F", label: "Ons Altın / USD", unit: "$", decimals: 2, sourceSymbol: "GC=F" },
  { key: "GRAM_ALTIN_TRY", label: "Gram Altın / TL", unit: "₺", decimals: 2, derived: "goldGram" },
  { key: "GRAM_GUMUS_TRY", label: "Gümüş / gram TL", unit: "₺", decimals: 2, derived: "silverGram" },
  { key: "XU030.IS", label: "BIST 30", unit: "", decimals: 2, sourceSymbol: "XU030.IS" },
  { key: "XU050.IS", label: "BIST 50", unit: "", decimals: 2, sourceSymbol: "XU050.IS" },
  { key: "XU100.IS", label: "BIST 100", unit: "", decimals: 2, sourceSymbol: "XU100.IS" },
];

const normalizeSymbol = (symbol: string) => symbol.replace(/\.IS$/i, "").toUpperCase();

function deriveTryPerGram(
  metal: QuoteData | undefined,
  usdTry: QuoteData | undefined,
  symbol: string,
  label: string,
): QuoteData | null {
  if (!metal || !usdTry || metal.regularMarketPrice <= 0 || usdTry.regularMarketPrice <= 0) return null;
  const price = (metal.regularMarketPrice * usdTry.regularMarketPrice) / TROY_OUNCE_GRAMS;
  const metalFactor = 1 + (metal.regularMarketChangePercent || 0) / 100;
  const usdFactor = 1 + (usdTry.regularMarketChangePercent || 0) / 100;
  const changePercent = (metalFactor * usdFactor - 1) * 100;
  const previousClose = price / (1 + changePercent / 100);
  return {
    symbol,
    shortName: label,
    regularMarketPrice: price,
    regularMarketChangePercent: changePercent,
    regularMarketChange: price - previousClose,
    regularMarketVolume: 0,
    regularMarketPreviousClose: previousClose,
    regularMarketOpen: 0,
    regularMarketDayHigh: 0,
    regularMarketDayLow: 0,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
    marketCap: 0,
    averageDailyVolume3Month: 0,
  };
}

export default function SummaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [news, setNews] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [macro, latestNews] = await Promise.all([
      fetchMacroQuotes(MACRO_SOURCE_SYMBOLS),
      fetchMarketNews("Borsa Istanbul", 8),
    ]);
    const next: Record<string, QuoteData> = {};
    macro.forEach((quote) => { next[normalizeSymbol(quote.symbol)] = quote; });
    const goldGram = deriveTryPerGram(next["GC=F"], next["USDTRY=X"], "GRAM_ALTIN_TRY", "Gram Altın / TL");
    const silverGram = deriveTryPerGram(next["SI=F"], next["USDTRY=X"], "GRAM_GUMUS_TRY", "Gümüş / gram TL");
    if (goldGram) next[goldGram.symbol] = goldGram;
    if (silverGram) next[silverGram.symbol] = silverGram;
    setQuotes(next);
    setNews(latestNews);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Makro verileri 5 dakikada bir yenilenir; manuel yenileme düğmesi de kullanılabilir.
    const timer = setInterval(() => void load(), 300000);
    return () => clearInterval(timer);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const formatValue = (asset: MacroAsset, quote?: QuoteData) => {
    if (!quote || !Number.isFinite(quote.regularMarketPrice) || quote.regularMarketPrice <= 0) return "—";
    return `${asset.unit}${quote.regularMarketPrice.toLocaleString("tr-TR", { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals })}`;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 92 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Piyasa Özeti</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Döviz, altın ve BIST endeksleri</Text>
          </View>
          <Pressable onPress={refresh} hitSlop={10} style={[styles.refreshButton, { backgroundColor: colors.secondary }]}>
            <IconRefresh color={colors.mutedForeground} size={16} />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Makro Göstergeler</Text>
        <View style={styles.grid}>
          {MACRO_ASSETS.map((asset) => {
            const quoteKey = asset.derived ? asset.key : normalizeSymbol(asset.sourceSymbol ?? asset.key);
            const quote = quotes[quoteKey];
            const change = quote?.regularMarketChangePercent;
            const changeColor = change == null ? colors.mutedForeground : change >= 0 ? colors.up : colors.down;
            return (
              <View key={asset.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{asset.label}</Text>
                <Text style={[styles.cardValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{formatValue(asset, quote)}</Text>
                <Text style={[styles.cardChange, { color: changeColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {change == null ? (loading ? "Yükleniyor" : "Veri yok") : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.newsHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 0, marginBottom: 2 }]}>Borsa Istanbul haberleri</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Kaynakta gerçek haber yoksa kart gösterilmez.</Text>
          </View>
          {lastUpdated && <Text style={[styles.updated, { color: colors.mutedForeground }]}>{lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Text>}
        </View>
        {news.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>{loading ? "Haberler yükleniyor…" : "Bu sorgu için doğrulanmış haber bulunamadı."}</Text>
        ) : (
          <View style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            {news.map((item, index) => (
              <Pressable key={`${item.title}-${index}`} disabled={!item.link} onPress={() => item.link && Linking.openURL(item.link)} style={[styles.newsRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}> 
                <View style={[styles.newsDot, { backgroundColor: colors.primary }]} />
                <View style={styles.newsCopy}>
                  <Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={3}>{item.title}</Text>
                  <Text style={[styles.newsMeta, { color: colors.mutedForeground }]}>{item.publisher || "Kaynak belirtilmedi"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 25, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  refreshButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sectionTitle: { paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  grid: { paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { width: "48.7%", minWidth: 0, minHeight: 112, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 12, justifyContent: "space-between" },
  cardLabel: { fontSize: 11, lineHeight: 15, fontFamily: "Inter_500Medium" },
  cardValue: { fontSize: 19, lineHeight: 24, fontFamily: "Inter_700Bold", marginTop: 7 },
  cardChange: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_600SemiBold", marginTop: 5 },
  newsHeader: { paddingHorizontal: 16, marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  updated: { fontSize: 10, fontFamily: "Inter_400Regular" },
  empty: { paddingHorizontal: 16, paddingVertical: 18, fontSize: 12, fontFamily: "Inter_400Regular" },
  newsCard: { marginHorizontal: 12, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  newsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingVertical: 11 },
  newsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  newsCopy: { flex: 1 },
  newsTitle: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_600SemiBold" },
  newsMeta: { fontSize: 10, marginTop: 4, fontFamily: "Inter_400Regular" },
});
