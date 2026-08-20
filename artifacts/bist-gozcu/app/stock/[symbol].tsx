import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { AlertType, useAlerts } from "@/contexts/AlertContext";
import { fetchChartData, fetchStockOverview, ChartResult, ChartRange, getMarketSession, StockOverview } from "@/utils/yahooFinance";
import {
  analyzeStock,
  AnalysisResult,
  alma,
  atr,
  macd,
  moneyFlowIndex,
  rsi,
  sma,
  tilsonT3,
} from "@/utils/indicators";
import { getStockMeta } from "@/constants/bistStocks";
import PriceChart from "@/components/PriceChart";
import {
  IconStar,
  IconNotifications,
  IconAlarmClock,
  IconCheckMark,
  IconArrowUp,
  IconArrowDown,
  IconTrendingUp,
  IconTrendingDown,
  IconTrash,
  IconX,
} from "@/components/TabIcon";

const RANGES: { key: ChartRange; label: string }[] = [
  { key: "1d",  label: "1G" },
  { key: "5d",  label: "1H" },
  { key: "1mo", label: "1A" },
  { key: "3mo", label: "3A" },
  { key: "6mo", label: "6A" },
  { key: "1y",  label: "1Y" },
  { key: "5y",  label: "5Y" },
];

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

const INDICATOR_INFO: Record<string, { title: string; body: string }> = {
  RSI: {
    title: "RSI (Göreceli Güç Endeksi)",
    body: "Fiyatın son 14 günde ne kadar hızlı yükselip düştüğünü ölçer (0-100). 30'un altı 'aşırı satım' (tepki alımı gelebilir), 70'in üstü 'aşırı alım' (kâr satışı gelebilir) anlamına gelir. Tek başına al/sat kararı için yeterli değildir, trend yönüyle birlikte değerlendirilmelidir.",
  },
  MFI: {
    title: "MFI (Para Akışı Endeksi)",
    body: "RSI'a benzer ama hacmi de hesaba katar (0-100). 20'nin altı para girişinin zayıfladığını, 80'in üstü aşırı yüksek para girişi olduğunu (satış riski) gösterir. Hacim temelli olduğu için RSI'ı teyit etmek amacıyla birlikte kullanılır.",
  },
};

function IndicatorCard({ label, value, subLabel, min, max, color, onInfoPress }: {
  label: string;
  subLabel?: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onInfoPress?: () => void;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  const displayVal = isNaN(value) ? "—" : value.toFixed(1);
  return (
    <Pressable
      onPress={onInfoPress}
      style={[styles.indCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.indCardTop}>
        <View style={styles.indCardLeft}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[styles.indLabel, { color: colors.foreground }]}>{label}</Text>
            <View style={[styles.infoDot, { borderColor: colors.mutedForeground }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, fontFamily: "Inter_700Bold" }}>i</Text>
            </View>
          </View>
          {subLabel && <Text style={[styles.indSub, { color: colors.mutedForeground }]}>{subLabel}</Text>}
        </View>
        <Text style={[styles.indValue, { color }]}>{displayVal}</Text>
      </View>
      <View style={[styles.indTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.indFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </Pressable>
  );
}

export default function StockDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { quotes } = useStocks();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [stockOverview, setStockOverview] = useState<StockOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [range, setRange] = useState<ChartRange>("1d");
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [alarmTarget, setAlarmTarget] = useState("");
  const [alarmType, setAlarmType] = useState<AlertType>("above");
  const [alarmNote, setAlarmNote] = useState("");
  const [infoKey, setInfoKey] = useState<string | null>(null);

  const symbolText = symbol?.toUpperCase().trim() ?? "";
  const quote = quotes[symbol ?? ""] ?? stockOverview?.quote;
  const meta = getStockMeta(symbol ?? "");
  const fav = favorites.includes(symbolText);
  const watched = watchlist.includes(symbolText);
  const session = getMarketSession();

  useEffect(() => {
    if (!symbol) return;
    setLoadingOverview(true);
    fetchStockOverview(symbol).then((data) => setStockOverview(data)).finally(() => setLoadingOverview(false));
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    setLoadingChart(true);
    fetchChartData(symbol, range).then((data) => {
      setChart(data);
      if (data && data.closes.length >= 14) {
        setAnalysis(analyzeStock(data.closes, data.highs, data.lows, data.volumes));
      } else {
        setAnalysis(null);
      }
      setLoadingChart(false);
    });
  }, [symbol, range]);

  const handleFav = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol ?? "");
    else addFavorite(symbol ?? "");
  };

  const handleToggleWatchlist = () => {
    if (watched) {
      removeFromWatchlist(symbolText);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      addToWatchlist(symbolText);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRangeChange = (r: ChartRange) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setRange(r);
  };

  const symbolAlerts = alerts.filter((a) => a.symbol === symbolText);

  const handleOpenAlarmModal = () => {
    if (symbolAlerts.length >= 6) {
      Alert.alert("Alarm sınırı", "Bir hisse için en fazla 6 fiyat alarmı kurabilirsiniz.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlarmTarget("");
    setAlarmNote("");
    setAlarmType("above");
    setShowAlarmModal(true);
  };

  const handleSaveAlarm = () => {
    const target = Number.parseFloat(alarmTarget.replace(",", "."));
    if (!symbolText || !Number.isFinite(target) || target <= 0) {
      Alert.alert("Hata", "Geçerli bir hedef fiyat girin.");
      return;
    }
    if (symbolAlerts.length >= 6) {
      Alert.alert("Alarm sınırı", "Bir hisse için en fazla 6 fiyat alarmı kurabilirsiniz.");
      return;
    }
    addAlert(symbolText, target, alarmType, alarmNote.trim());
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAlarmModal(false);
    setAlarmTarget("");
    setAlarmNote("");
  };

  const handleRemoveAlarm = (id: string) => {
    Alert.alert("Alarmı sil", "Bu fiyat alarmı silinsin mi?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => removeAlert(id) },
    ]);
  };

  const price = quote?.regularMarketPrice;
  const change = quote?.regularMarketChangePercent;
  const changeVal = quote?.regularMarketChange;
  const changeColor =
    change == null ? colors.mutedForeground :
    change > 0 ? colors.up :
    change < 0 ? colors.down :
    colors.neutral;

  const formatNum = (n?: number) =>
    n != null ? n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—";
  const formatBig = (n?: number) => {
    if (!n) return "—";
    if (n >= 1e12) return `₺${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `₺${(n / 1e9).toFixed(2)}Mr`;
    if (n >= 1e6) return `₺${(n / 1e6).toFixed(2)}M`;
    return `₺${n.toLocaleString("tr-TR")}`;
  };

  const n = chart?.closes.length ?? 0;
  const macdData    = chart && n >= 26 ? macd(chart.closes) : null;
  const rsiData     = chart && n >= 14 ? rsi(chart.closes) : null;
  const mfiData     = chart && n >= 14 ? moneyFlowIndex(chart.highs, chart.lows, chart.closes, chart.volumes) : null;
  const ma20Data    = chart && n >= 20 ? sma(chart.closes, 20) : null;
  const ma50Data    = chart && n >= 50 ? sma(chart.closes, 50) : null;
  const ma100Data   = chart && n >= 100 ? sma(chart.closes, 100) : null;
  const ma200Data   = chart && n >= 200 ? sma(chart.closes, 200) : null;
  const almaData    = chart && n >= 9 ? alma(chart.closes, 9) : null;
  const t3Data      = chart && n >= 25 ? tilsonT3(chart.closes, 5) : null;
  const atrData     = chart && n >= 15 ? atr(chart.highs, chart.lows, chart.closes, 14) : null;

  const latestMacd  = macdData?.macd[n - 1];
  const latestHist  = macdData?.histogram[n - 1];
  const latestRsi   = rsiData?.[n - 1];
  const latestMfi   = mfiData?.[n - 1];
  const latestMa20  = ma20Data?.[n - 1];
  const latestMa50  = ma50Data?.[n - 1];
  const latestMa100 = ma100Data?.[n - 1];
  const latestMa200 = ma200Data?.[n - 1];
  const latestAlma  = almaData?.[n - 1];
  const latestT3    = t3Data?.[n - 1];
  const latestAtr   = atrData?.[n - 1];

  const chartPrices = chart?.closes.filter((close) => close > 0) ?? [];
  const chartStartPrice = chartPrices[0];
  const chartEndPrice = chartPrices[chartPrices.length - 1];
  const chartPerformance =
    chartStartPrice && chartEndPrice
      ? ((chartEndPrice - chartStartPrice) / chartStartPrice) * 100
      : null;
  const chartPerformanceColor =
    chartPerformance == null
      ? colors.mutedForeground
      : chartPerformance >= 0
      ? colors.up
      : colors.down;

  const volatility = (() => {
    if (!chart || n < 10) return null;
    const returns = chart.closes.slice(-20).map((c, i, arr) => {
      if (i === 0) return 0;
      return Math.abs((c - arr[i - 1]) / arr[i - 1]);
    }).slice(1);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    return avg * 100;
  })();

  const morningReport = (() => {
    if (!analysis || price == null) return "Veri yükleniyor...";
    const lines: string[] = [];

    const signalLine =
      analysis.signal === "buy"
        ? `${symbol} teknik tabloda ALIM tarafında: ${analysis.reasons.length} gösterge fiyatın lehine.`
        : analysis.signal === "sell"
        ? `${symbol} teknik tabloda SATIM baskısı altında: ${analysis.reasons.length} gösterge fiyatın aleyhine.`
        : `${symbol} şu an nötr bölgede, göstergeler net bir yön vermiyor.`;
    lines.push(signalLine);

    if (latestMa20 != null && latestMa50 != null) {
      const gapPct = ((latestMa20 - latestMa50) / latestMa50) * 100;
      if (Math.abs(gapPct) < 0.3) {
        lines.push(`20 ve 50 günlük ortalamalar birbirine çok yakın (%${Math.abs(gapPct).toFixed(2)} fark), yön arayışı sürüyor.`);
      } else if (latestMa20 > latestMa50) {
        lines.push(`20 günlük ortalama, 50 günlüğün %${gapPct.toFixed(1)} üzerinde; orta vadeli trend yukarı eğilimli.`);
      } else {
        lines.push(`20 günlük ortalama, 50 günlüğün %${Math.abs(gapPct).toFixed(1)} altında; orta vadeli trend baskı altında.`);
      }
      if (price > latestMa20 && price > latestMa50) {
        lines.push(`Fiyat her iki ortalamanın da üzerinde seyrediyor, kısa vadeli momentum güçlü.`);
      } else if (price < latestMa20 && price < latestMa50) {
        lines.push(`Fiyat her iki ortalamanın da altında, kısa vadeli momentum zayıf.`);
      }
    }

    if (latestRsi != null) {
      if (latestRsi >= 70) lines.push(`RSI ${latestRsi.toFixed(0)} ile aşırı alım bölgesinde, kısa vadeli geri çekilme riski artabilir.`);
      else if (latestRsi <= 30) lines.push(`RSI ${latestRsi.toFixed(0)} ile aşırı satım bölgesinde, tepki alımları gelebilir.`);
      else if (latestRsi > 55) lines.push(`RSI ${latestRsi.toFixed(0)} seviyesinde, alıcı baskısı hafif üstün.`);
      else if (latestRsi < 45) lines.push(`RSI ${latestRsi.toFixed(0)} seviyesinde, satıcı baskısı hafif üstün.`);
    }

    if (latestMfi != null) {
      if (latestMfi >= 80) lines.push(`Para akışı endeksi (MFI) ${latestMfi.toFixed(0)} ile aşırı yüksek, kâr satışı ihtimali var.`);
      else if (latestMfi <= 20) lines.push(`Para akışı endeksi (MFI) ${latestMfi.toFixed(0)} ile düşük, para girişi zayıf.`);
    }

    if (latestMacd != null && latestHist != null) {
      if (latestHist > 0 && latestMacd > 0) lines.push(`MACD pozitif bölgede ve histogram artıda, momentum yukarı yönlü.`);
      else if (latestHist < 0 && latestMacd < 0) lines.push(`MACD negatif bölgede ve histogram ekside, momentum aşağı yönlü.`);
      else if (latestHist > 0) lines.push(`MACD histogramı pozitife döndü, olası bir toparlanma sinyali.`);
      else if (latestHist < 0) lines.push(`MACD histogramı negatife döndü, momentum kayboluyor.`);
    }

    if (latestAtr != null && price > 0) {
      const atrPct = (latestAtr / price) * 100;
      if (atrPct > 3) lines.push(`ATR bazlı volatilite yüksek (%${atrPct.toFixed(1)}), pozisyon boyutunu buna göre ayarlayın.`);
    } else if (volatility != null && volatility > 2) {
      lines.push(`Son 20 günün ortalama günlük hareketi %${volatility.toFixed(1)}, dalgalanma yüksek.`);
    }

    return lines.filter(Boolean).join("\n");
  })();

  const activeAlerts = symbolAlerts.filter((a) => !a.triggered);
  const fundamentals = stockOverview?.fundamentals;
  const formatRatio = (value: number | null | undefined, suffix = "") => value == null ? "—" : `${value.toFixed(2)}${suffix}`;
  const formatRatioPercent = (value: number | null | undefined) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
  const targetUpside = price != null && fundamentals?.targetMeanPrice != null && price > 0
    ? ((fundamentals.targetMeanPrice - price) / price) * 100
    : null;
  const valuationTitle = targetUpside != null
    ? targetUpside >= 15
      ? "Hedef fiyata göre iskontolu görünüyor"
      : targetUpside <= -15
        ? "Hedef fiyata göre primli görünüyor"
        : "Hedef fiyata göre dengeli görünüyor"
    : fundamentals?.priceToBook != null && fundamentals.priceToBook < 1
      ? "PD/DD düşük; tek başına ucuzluk kanıtı değil"
      : fundamentals?.priceToBook != null && fundamentals.priceToBook > 3
        ? "PD/DD yüksek; primli değerleme riski var"
        : "Göreli değerleme için veri bekleniyor";
  const valuationText = targetUpside != null
    ? `Analist ortalama hedefi ₺${fundamentals?.targetMeanPrice?.toFixed(2)}; mevcut fiyata göre ${targetUpside >= 0 ? "+" : ""}${targetUpside.toFixed(1)}% fark var. Bu hedef garanti değildir ve analist kapsamı ${fundamentals?.analystCount ?? "bilinmiyor"} kişi olabilir.`
    : fundamentals?.priceToBook != null
      ? `PD/DD ${fundamentals.priceToBook.toFixed(2)}. Ucuz/pahalı yorumu için sektör ortalaması, borçluluk ve kârlılık birlikte değerlendirilmelidir.`
      : "Temel oranlar bu kaynakta bulunamadı; bu nedenle ucuz veya pahalı hükmü verilmiyor.";

  const sessionLabel =
    session === "open" ? "Açık" :
    session === "pre" ? "Açılış öncesi" :
    session === "post" ? "Kapanış sonrası" : "Kapalı";

  const rsiColor = latestRsi == null ? colors.mutedForeground :
    latestRsi < 30 ? colors.up : latestRsi > 70 ? colors.down : colors.neutral;
  const mfiColor = latestMfi == null ? colors.mutedForeground :
    latestMfi < 20 ? colors.up : latestMfi > 80 ? colors.down : colors.neutral;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: symbol ?? "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_700Bold", fontSize: 17 },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleOpenAlarmModal}
                style={({ pressed }) => [styles.headerAlarmBtn, pressed && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={`${symbol ?? "Hisse"} fiyat alarmı kur`}
                accessibilityHint="Bu hisse için en fazla 6 fiyat alarmı açar"
                testID="stock-detail-alarm"
              >
                <IconAlarmClock size={20} color={activeAlerts.length > 0 ? colors.primary : colors.mutedForeground} />
                {activeAlerts.length > 0 && <Text style={[styles.headerAlarmCount, { color: colors.primary }]}>{activeAlerts.length}</Text>}
              </Pressable>
              <Pressable
                onPress={handleToggleWatchlist}
                style={({ pressed }) => [
                  styles.headerWatchBtn,
                  { backgroundColor: watched ? `${colors.up}20` : "transparent" },
                  pressed && { backgroundColor: watched ? `${colors.up}35` : colors.accent },
                ]}
                accessibilityRole="button"
                accessibilityLabel={watched ? "Takipten çıkar" : "Takibe al"}
                accessibilityHint="Hisseyi takip listesine ekler veya çıkarır"
                testID="stock-detail-watchlist"
              >
                <IconCheckMark size={18} color={watched ? colors.up : colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={handleFav}
                style={({ pressed }) => [styles.headerFavoriteBtn, pressed && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={`${symbol ?? "Hisse"} ${fav ? "favorilerden çıkar" : "favorilere ekle"}`}
                accessibilityHint="Hisseyi Favoriler ekranına ekler veya çıkarır"
                testID="stock-detail-favorite"
              >
                <IconStar size={21} color={fav ? colors.primary : colors.mutedForeground} filled={fav} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Price Hero */}
        <View style={[styles.priceHero, { borderBottomColor: colors.border }]}>
          <View style={styles.priceLeft}>
            <Text style={[styles.companyName, { color: colors.mutedForeground }]}>
              {meta?.name ?? symbol}
            </Text>
            <Text style={[styles.priceText, { color: colors.foreground }]}>
              {price != null ? `₺${price.toFixed(2)}` : "—"}
            </Text>
            <View style={styles.changeRow}>
              <View style={[styles.changePill, { backgroundColor: `${changeColor}20` }]}>
                <Text style={[styles.changeAbs, { color: changeColor }]}>
                  {changeVal != null ? `${changeVal >= 0 ? "+" : ""}₺${changeVal.toFixed(2)}` : ""}
                </Text>
                <Text style={[styles.changePct, { color: changeColor }]}>
                  {change != null ? ` (${change >= 0 ? "+" : ""}${change.toFixed(2)}%)` : ""}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.priceRight}>
            <View style={styles.sessionRow}>
              <View style={[styles.sessionDot, {
                backgroundColor: session === "open" ? colors.up : colors.mutedForeground
              }]} />
              <Text style={[styles.sessionText, { color: colors.mutedForeground }]}>{sessionLabel}</Text>
            </View>
          </View>
        </View>

        {/* Range Selector */}
        <View style={[styles.rangeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {RANGES.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[
                styles.rangeBtn,
                range === key && [styles.rangeBtnActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => handleRangeChange(key)}
            >
              <Text style={[
                styles.rangeBtnText,
                { color: range === key ? "#fff" : colors.mutedForeground },
              ]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Chart */}
        {loadingChart ? (
          <View style={styles.chartLoader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : chart && chart.closes.filter((c) => c > 0).length >= 2 ? (
          <PriceChart
            closes={chart.closes}
            volumes={chart.volumes}
            timestamps={chart.timestamps}
            range={range}
          />
        ) : (
          <View style={styles.chartLoader}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Grafik verisi yok</Text>
          </View>
        )}

        {/* Selected range performance */}
        {chartPerformance != null && chartStartPrice != null && chartEndPrice != null && (
          <View style={[styles.performanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>
                {RANGES.find((item) => item.key === range)?.label ?? range} performansı
              </Text>
              <Text style={[styles.performanceSub, { color: colors.mutedForeground }]}>
                Başlangıç ₺{chartStartPrice.toFixed(2)} · Son ₺{chartEndPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.performanceValueWrap}>
              <Text style={[styles.performanceAmount, { color: chartPerformanceColor }]}>
                {chartEndPrice - chartStartPrice >= 0 ? "+" : ""}₺{(chartEndPrice - chartStartPrice).toFixed(2)}
              </Text>
              <Text style={[styles.performancePercent, { color: chartPerformanceColor }]}>
                {chartPerformance >= 0 ? "+" : ""}{chartPerformance.toFixed(2)}%
              </Text>
            </View>
          </View>
        )}

        {/* Price Info */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fiyat Bilgisi</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Açılış</Text>
              <Text style={[styles.statCardValue, { color: colors.foreground }]}>₺{formatNum(quote?.regularMarketOpen)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Önceki Kapanış</Text>
              <Text style={[styles.statCardValue, { color: colors.foreground }]}>₺{formatNum(quote?.regularMarketPreviousClose)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Gün Yüksek</Text>
              <Text style={[styles.statCardValue, { color: colors.up }]}>₺{formatNum(quote?.regularMarketDayHigh)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Gün Düşük</Text>
              <Text style={[styles.statCardValue, { color: colors.down }]}>₺{formatNum(quote?.regularMarketDayLow)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>52H Yüksek</Text>
              <Text style={[styles.statCardValue, { color: colors.up }]}>₺{formatNum(quote?.fiftyTwoWeekHigh)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>52H Düşük</Text>
              <Text style={[styles.statCardValue, { color: colors.down }]}>₺{formatNum(quote?.fiftyTwoWeekLow)}</Text>
            </View>
          </View>
          <StatRow label="Piyasa Değeri" value={formatBig(quote?.marketCap)} />
          <StatRow label="Günlük Hacim"  value={formatBig(quote?.regularMarketVolume)} />
        </View>

        {/* Technical Indicators */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teknik Analiz</Text>
          {loadingChart ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
          ) : (
            <>
              <View style={styles.indGrid}>
                {latestRsi != null && (
                  <IndicatorCard label="RSI" subLabel="Aşırı Al/Sat" value={latestRsi} min={0} max={100} color={rsiColor} onInfoPress={() => setInfoKey("RSI")} />
                )}
                {latestMfi != null && (
                  <IndicatorCard label="MFI" subLabel="Para Akışı" value={latestMfi} min={0} max={100} color={mfiColor} onInfoPress={() => setInfoKey("MFI")} />
                )}
              </View>
              <Text style={[styles.indHint, { color: colors.mutedForeground }]}>
                Bu göstergeler birbirini teyit etmek için birlikte kullanılır; hiçbiri tek başına kesin sinyal sayılmaz. Detay için bir göstergeye dokunun.
              </Text>

              <View style={[styles.maRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  { label: "MA 20", val: latestMa20, sub: price != null && latestMa20 != null ? (price > latestMa20 ? "Üstünde" : "Altında") : "" },
                  { label: "MA 50", val: latestMa50, sub: price != null && latestMa50 != null ? (price > latestMa50 ? "Üstünde" : "Altında") : "" },
                  { label: "MA 100", val: latestMa100, sub: price != null && latestMa100 != null ? (price > latestMa100 ? "Üstünde" : "Altında") : "" },
                  { label: "MA 200", val: latestMa200, sub: price != null && latestMa200 != null ? (price > latestMa200 ? "Üstünde" : "Altında") : "" },
                  { label: "ALMA 9", val: latestAlma, sub: price != null && latestAlma != null ? (price > latestAlma ? "Üstünde" : "Altında") : "" },
                  { label: "Tilson T3", val: latestT3, sub: price != null && latestT3 != null ? (price > latestT3 ? "Üstünde" : "Altında") : "" },
                  { label: "MACD", val: latestMacd, sub: `Hist: ${latestHist?.toFixed(2) ?? "—"}`, isMacd: true },
                  { label: "ATR", val: latestAtr, sub: "Volatilite", isAtr: true },
                ].map((item, idx) => {
                  if (item.val == null) return null;
                  let valColor = colors.foreground;
                  if (item.isMacd) valColor = latestHist != null ? (latestHist > 0 ? colors.up : colors.down) : colors.foreground;
                  else if (item.isAtr) valColor = price != null && item.val / price > 0.03 ? colors.neutral : colors.foreground;
                  else if (price != null) valColor = price > item.val ? colors.up : colors.down;

                  return (
                    <View key={item.label} style={[styles.maItem, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                      <View>
                        <Text style={[styles.maLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                        <Text style={[styles.maSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                      </View>
                      <Text style={[styles.maValue, { color: valColor }]}>
                        {item.isMacd ? item.val.toFixed(2) : `₺${item.val.toFixed(2)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {volatility != null && (
                <StatRow
                  label="Volatilite (20G)"
                  value={`${volatility.toFixed(2)}%`}
                  valueColor={volatility > 2 ? colors.neutral : undefined}
                />
              )}
            </>
          )}
        </View>

        {/* Relative valuation */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Temel / Göreli Değerleme</Text>
          <View style={[styles.valuationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.valuationTitle, { color: targetUpside != null && targetUpside >= 15 ? colors.up : targetUpside != null && targetUpside <= -15 ? colors.down : colors.foreground }]}>{valuationTitle}</Text>
            <Text style={[styles.valuationText, { color: colors.mutedForeground }]}>{loadingOverview ? "Temel oranlar yükleniyor…" : valuationText}</Text>
            <View style={styles.fundamentalGrid}>
              <StatRow label="F/K" value={formatRatio(fundamentals?.trailingPE)} />
              <StatRow label="İleri F/K" value={formatRatio(fundamentals?.forwardPE)} />
              <StatRow label="PD/DD" value={formatRatio(fundamentals?.priceToBook)} />
              <StatRow label="PD/S" value={formatRatio(fundamentals?.priceToSales)} />
              <StatRow label="Özsermaye kârlılığı" value={formatRatioPercent(fundamentals?.returnOnEquity)} />
              <StatRow label="Borç/Özsermaye" value={formatRatio(fundamentals?.debtToEquity)} />
            </View>
            <Text style={[styles.dataBasis, { color: colors.mutedForeground }]}>F/K ve PD/DD gibi oranlar kaynakta bulunamazsa “—” gösterilir; sektör karşılaştırması olmadan kesin ucuz/pahalı kararı verilmez.</Text>
          </View>
        </View>

        {/* Hisse-specific morning report */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hisseye Özel Sabah Raporu</Text>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reportText, { color: colors.mutedForeground }]}>{morningReport}</Text>
          </View>
        </View>

        {/* Stock-specific news */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hisse Haberleri</Text>
          {loadingOverview ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 18 }} />
          ) : stockOverview?.news.length ? (
            <View style={[styles.stockNewsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {stockOverview.news.map((item, index) => (
                <Pressable key={`${item.title}-${index}`} disabled={!item.link} onPress={() => item.link && Linking.openURL(item.link)} style={[styles.stockNewsRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <View style={[styles.newsDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.newsCopy}>
                    <Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={3}>{item.title}</Text>
                    <Text style={[styles.newsMeta, { color: colors.mutedForeground }]}>{item.publisher || "Kaynak belirtilmedi"}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.noNewsText, { color: colors.mutedForeground }]}>Bu hisse için kaynakta doğrulanmış haber bulunamadı.</Text>
          )}
        </View>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aktif Alarmlar</Text>
            {activeAlerts.map((a) => (
              <View key={a.id} style={[styles.alertChip, { backgroundColor: `${colors.neutral}15`, borderColor: `${colors.neutral}30` }]}>
                <IconNotifications color={colors.neutral} size={13} />
                <Text style={[styles.alertChipText, { color: colors.mutedForeground }]}>
                  {a.alertType === "tp" ? "Kâr al" :
                   a.alertType === "sl" ? "Zarar kes" :
                   a.alertType === "above" ? "Üstüne çıkınca" : "Altına düşünce"}: ₺{a.targetPrice.toFixed(2)}
                </Text>
                <Pressable onPress={() => handleRemoveAlarm(a.id)} hitSlop={10} style={styles.alertDeleteBtn}>
                  <IconTrash color={colors.mutedForeground} size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>



      {/* ── Price alert modal ── */}
      <Modal
        visible={showAlarmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlarmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            style={styles.keyboardLayer}
          >
            <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Fiyat Alarmı</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{symbolText} · {symbolAlerts.length}/6 alarm</Text>
                </View>
                <Pressable onPress={() => setShowAlarmModal(false)} hitSlop={12} style={[styles.modalCloseBtn, { backgroundColor: colors.secondary }]}>
                  <IconX color={colors.mutedForeground} size={15} />
                </Pressable>
              </View>

              <View style={styles.modalTopNotice}>
                <Text style={[styles.modalTopNoticeTitle, { color: colors.foreground }]}>Alarm ayarı</Text>
                <Text style={[styles.modalTopNoticeText, { color: colors.mutedForeground }]}>Hedef fiyatı girin; klavye açıldığında alanlar yukarıda kalır.</Text>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Alarm türü</Text>
                <View style={styles.alarmTypeRow}>
                  {([
                    ["above", "Üstüne çıkınca", IconArrowUp, colors.up],
                    ["below", "Altına düşünce", IconArrowDown, colors.down],
                    ["tp", "Kâr al", IconTrendingUp, colors.up],
                    ["sl", "Zarar kes", IconTrendingDown, colors.down],
                  ] as const).map(([type, label, Icon, typeColor]) => {
                    const active = alarmType === type;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.alarmTypeBtn, { backgroundColor: active ? `${typeColor}20` : colors.input, borderColor: active ? typeColor : colors.border }]}
                        onPress={() => setAlarmType(type)}
                      >
                        <Icon color={active ? typeColor : colors.mutedForeground} size={14} />
                        <Text style={[styles.alarmTypeText, { color: active ? typeColor : colors.mutedForeground }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Hedef fiyat (₺)</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={alarmTarget}
                  onChangeText={setAlarmTarget}
                  keyboardType="decimal-pad"
                  placeholder={price != null ? price.toFixed(2) : "150.00"}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Not (opsiyonel)</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={alarmNote}
                  onChangeText={setAlarmNote}
                  placeholder="Örn. direnç seviyesi"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveAlarm}>
                <Text style={styles.saveBtnText}>Alarmı Kur</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Indicator Info Modal ── */}
      <Modal
        visible={infoKey != null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoKey(null)}
      >
        <Pressable style={styles.infoOverlay} onPress={() => setInfoKey(null)}>
          <Pressable style={[styles.infoSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {infoKey ? INDICATOR_INFO[infoKey]?.title : ""}
              </Text>
              <Pressable onPress={() => setInfoKey(null)} hitSlop={12}
                style={[styles.modalCloseBtn, { backgroundColor: colors.secondary }]}>
                <IconX color={colors.mutedForeground} size={15} />
              </Pressable>
            </View>
            <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
              {infoKey ? INDICATOR_INFO[infoKey]?.body : ""}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  priceHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  priceLeft: { flex: 1 },
  priceRight: { alignItems: "flex-end", gap: 10, marginTop: 2 },
  companyName: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  priceText: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  changeRow: { flexDirection: "row", marginTop: 6 },
  changePill: { flexDirection: "row", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  changeAbs: { fontSize: 14, fontFamily: "Inter_500Medium" },
  changePct: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sessionDot: { width: 6, height: 6, borderRadius: 3 },
  sessionText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rangeBtnActive: {},
  rangeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chartLoader: { height: 236, alignItems: "center", justifyContent: "center" },
  section: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 14, letterSpacing: 0.2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statCardLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statCardValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  statLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  indGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  indCard: {
    flex: 1,
    minWidth: "46%",
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  indCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  indCardLeft: { flex: 1 },
  indLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  indSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  indValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  indTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  indFill: { height: "100%", borderRadius: 2 },
  indHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginBottom: 12 },
  infoDot: {
    width: 13, height: 13, borderRadius: 7, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  infoOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 24,
  },
  infoSheet: {
    width: "100%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  maRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 8,
  },
  maItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  maLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  maValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  maSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  performanceCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  performanceLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  performanceSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  performanceValueWrap: { alignItems: "flex-end" },
  performanceAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  performancePercent: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  reportCard: { borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  reportText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21 },
  valuationCard: { borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  valuationTitle: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 20, marginBottom: 5 },
  valuationText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  fundamentalGrid: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(127,127,127,0.2)", marginTop: 4, paddingTop: 4 },
  dataBasis: { fontSize: 10, lineHeight: 15, fontFamily: "Inter_400Regular", marginTop: 8 },
  stockNewsCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  stockNewsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingVertical: 11 },
  newsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  newsCopy: { flex: 1 },
  newsTitle: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_600SemiBold" },
  newsMeta: { fontSize: 10, marginTop: 4, fontFamily: "Inter_400Regular" },
  noNewsText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  alertChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertChipText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  alertDeleteBtn: { marginLeft: "auto", padding: 4 },
  root: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerAlarmBtn: {
    minWidth: 38,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 5,
  },
  headerAlarmCount: { fontSize: 10, fontFamily: "Inter_700Bold" },
  headerWatchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 1,
  },
  headerFavoriteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  keyboardLayer: { width: "100%", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    maxHeight: "92%",
  },
  modalTopNotice: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(127,127,127,0.10)" },
  modalTopNoticeTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  modalTopNoticeText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  priceInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceInfoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  priceInfoVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  priceInfoChange: { fontSize: 12, fontFamily: "Inter_500Medium" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  alarmTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  alarmTypeBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  alarmTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  totalVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
