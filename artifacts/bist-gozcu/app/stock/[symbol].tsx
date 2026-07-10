import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useAlerts } from "@/contexts/AlertContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { fetchChartData, ChartResult, ChartRange, getMarketSession } from "@/utils/yahooFinance";
import {
  analyzeStock,
  AnalysisResult,
  macd,
  rsi,
  sma,
  moneyFlowIndex,
  atr,
  stochastic,
  aroon,
  detectCandlePatterns,
  getOverallCandleDirection,
  CandlePattern,
  getActionAdvice,
  backtestSignals,
  BacktestResult,
} from "@/utils/indicators";
import { getStockMeta } from "@/constants/bistStocks";
import SignalBadge from "@/components/SignalBadge";
import PriceChart from "@/components/PriceChart";
import {
  IconStar,
  IconCheck,
  IconClose,
  IconMinus,
  IconNotifications,
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
  "Stoch %K": {
    title: "Stokastik Osilatör (%K)",
    body: "Kapanış fiyatının son 14 günün en yüksek-en düşük aralığına göre nerede olduğunu gösterir (0-100). 20'nin altı aşırı satım, 80'in üstü aşırı alım bölgesidir. %K çizgisinin %D çizgisini yukarı/aşağı kesmesi kısa vadeli dönüş sinyali sayılır. RSI'a benzer ama daha hızlı tepki verir, bu yüzden yalancı sinyal üretebilir.",
  },
  MFI: {
    title: "MFI (Para Akışı Endeksi)",
    body: "RSI'a benzer ama hacmi de hesaba katar (0-100). 20'nin altı para girişinin zayıfladığını, 80'in üstü aşırı yüksek para girişi olduğunu (satış riski) gösterir. Hacim temelli olduğu için RSI'ı teyit etmek amacıyla birlikte kullanılır.",
  },
  Aroon: {
    title: "Aroon Göstergesi",
    body: "Son 25 günde en yüksek/en düşük fiyatın ne kadar süre önce oluştuğunu ölçerek trendin gücünü ve yönünü belirler. Aroon Up yüksek ve Aroon Down düşükse güçlü yükseliş trendi; tersi güçlü düşüş trendi anlamına gelir. Yatay/dalgalı piyasalarda güvenilirliği azalır.",
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
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { isWatched, addToWatchlist } = useWatchlist();
  const { alerts } = useAlerts();
  const { addEntry, getEntry, updateEntry } = usePortfolio();
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [candlePatterns, setCandlePatterns] = useState<CandlePattern[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [range, setRange] = useState<ChartRange>("3mo");
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [qty, setQty] = useState("");
  const [avgCostStr, setAvgCostStr] = useState("");
  const [note, setNote] = useState("");
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const qtyRef = useRef<TextInput>(null);

  const quote = quotes[symbol ?? ""];
  const meta = getStockMeta(symbol ?? "");
  const fav = isFavorite(symbol ?? "");
  const session = getMarketSession();

  useEffect(() => {
    if (!symbol) return;
    setLoadingChart(true);
    fetchChartData(symbol, range).then((data) => {
      setChart(data);
      if (data && data.closes.length >= 14) {
        const result = analyzeStock(data.closes, data.highs, data.lows, data.volumes);
        setAnalysis(result);
        if (data.opens.length >= 3) {
          const patterns = detectCandlePatterns(data.opens, data.highs, data.lows, data.closes);
          setCandlePatterns(patterns);
        }
      }
      setLoadingChart(false);
    });
  }, [symbol, range]);

  useEffect(() => {
    if (!symbol) return;
    fetchChartData(symbol, "6mo").then((data) => {
      if (data && data.closes.length >= 40) {
        setBacktest(backtestSignals(data.closes, data.highs, data.lows, data.volumes, 5));
      } else {
        setBacktest(null);
      }
    });
  }, [symbol]);

  const handleFav = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol ?? "");
    else addFavorite(symbol ?? "");
  };

  const watched = isWatched(symbol ?? "");

  const handleTakibeAl = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!fav) addFavorite(symbol ?? "");
    addToWatchlist(symbol ?? "");
  };

  const handleRangeChange = (r: ChartRange) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setRange(r);
  };

  const existingEntry = getEntry(symbol ?? "");

  const handleOpenPortfolioModal = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const prefill = existingEntry
      ? { q: existingEntry.quantity.toString(), avg: existingEntry.avgPrice.toString(), n: existingEntry.note }
      : { q: "", avg: price != null ? price.toFixed(2) : "", n: "" };
    setQty(prefill.q);
    setAvgCostStr(prefill.avg);
    setNote(prefill.n);
    setShowPortfolioModal(true);
    setTimeout(() => qtyRef.current?.focus(), 300);
  };

  const handleSavePortfolio = () => {
    const sym = symbol?.toUpperCase().trim() ?? "";
    const q = parseFloat(qty);
    const a = parseFloat(avgCostStr);
    if (!sym || isNaN(q) || q <= 0 || isNaN(a) || a <= 0) {
      Alert.alert("Hata", "Geçerli bir adet ve ortalama maliyet girin.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (existingEntry) updateEntry(existingEntry.id, q, a, note);
    else addEntry(sym, q, a, note);
    setShowPortfolioModal(false);
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
  const atrData     = chart && n >= 15 ? atr(chart.highs, chart.lows, chart.closes, 14) : null;
  const stochData   = chart && n >= 17 ? stochastic(chart.highs, chart.lows, chart.closes, 14, 3) : null;
  const aroonData   = chart && n >= 26 ? aroon(chart.highs, chart.lows, 25) : null;

  const latestMacd  = macdData?.macd[n - 1];
  const latestHist  = macdData?.histogram[n - 1];
  const latestRsi   = rsiData?.[n - 1];
  const latestMfi   = mfiData?.[n - 1];
  const latestMa20  = ma20Data?.[n - 1];
  const latestMa50  = ma50Data?.[n - 1];
  const latestAtr   = atrData?.[n - 1];
  const latestStochK = stochData?.k[n - 1];
  const latestStochD = stochData?.d[n - 1];
  const latestAroonUp   = aroonData?.up[n - 1];
  const latestAroonDown = aroonData?.down[n - 1];
  const latestAroonOsc  = aroonData?.oscillator[n - 1];

  const candleDir = getOverallCandleDirection(candlePatterns);
  const candleDirColor =
    candleDir === "bullish" ? colors.up :
    candleDir === "bearish" ? colors.down : colors.neutral;
  const candleDirLabel =
    candleDir === "bullish" ? "Yükseliş" :
    candleDir === "bearish" ? "Düşüş" : "Nötr";

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

    if (latestStochK != null && latestStochD != null) {
      if (latestStochK >= 80) lines.push(`Stokastik %K ${latestStochK.toFixed(0)} ile aşırı alımda.`);
      else if (latestStochK <= 20) lines.push(`Stokastik %K ${latestStochK.toFixed(0)} ile aşırı satımda.`);
      if (latestStochK > latestStochD && latestStochK < 80 && latestStochK > 20) {
        lines.push(`%K, %D'yi yukarı kesti; kısa vadede pozitif momentum sinyali.`);
      } else if (latestStochK < latestStochD && latestStochK < 80 && latestStochK > 20) {
        lines.push(`%K, %D'nin altına indi; kısa vadede negatif momentum sinyali.`);
      }
    }

    if (latestAroonUp != null && latestAroonDown != null) {
      if (latestAroonUp >= 70 && latestAroonUp > latestAroonDown) {
        lines.push(`Aroon Up ${latestAroonUp.toFixed(0)} ile güçlü, yükseliş trendi hakim.`);
      } else if (latestAroonDown >= 70 && latestAroonDown > latestAroonUp) {
        lines.push(`Aroon Down ${latestAroonDown.toFixed(0)} ile güçlü, düşüş trendi hakim.`);
      }
    }

    if (latestMacd != null && latestHist != null) {
      if (latestHist > 0 && latestMacd > 0) lines.push(`MACD pozitif bölgede ve histogram artıda, momentum yukarı yönlü.`);
      else if (latestHist < 0 && latestMacd < 0) lines.push(`MACD negatif bölgede ve histogram ekside, momentum aşağı yönlü.`);
      else if (latestHist > 0) lines.push(`MACD histogramı pozitife döndü, olası bir toparlanma sinyali.`);
      else if (latestHist < 0) lines.push(`MACD histogramı negatife döndü, momentum kayboluyor.`);
    }

    if (candlePatterns.length > 0) {
      lines.push(`Son mum formasyonu "${candlePatterns[0].name}" (${candleDirLabel.toLowerCase()} yönlü) olarak öne çıkıyor.`);
    }

    if (latestAtr != null && price > 0) {
      const atrPct = (latestAtr / price) * 100;
      if (atrPct > 3) lines.push(`ATR bazlı volatilite yüksek (%${atrPct.toFixed(1)}), pozisyon boyutunu buna göre ayarlayın.`);
    } else if (volatility != null && volatility > 2) {
      lines.push(`Son 20 günün ortalama günlük hareketi %${volatility.toFixed(1)}, dalgalanma yüksek.`);
    }

    return lines.filter(Boolean).join("\n");
  })();

  const activeAlerts = alerts.filter((a) => a.symbol === symbol && !a.triggered);

  const sessionLabel =
    session === "open" ? "Açık" :
    session === "pre" ? "Açılış öncesi" :
    session === "post" ? "Kapanış sonrası" : "Kapalı";

  const rsiColor = latestRsi == null ? colors.mutedForeground :
    latestRsi < 30 ? colors.up : latestRsi > 70 ? colors.down : colors.neutral;
  const stochColor = latestStochK == null ? colors.mutedForeground :
    latestStochK < 20 ? colors.up : latestStochK > 80 ? colors.down : colors.neutral;
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
            <Pressable onPress={handleFav} hitSlop={10} style={{ marginRight: 4 }}>
              <IconStar size={20} color={fav ? colors.neutral : colors.mutedForeground} filled={fav} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
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
            {analysis && <SignalBadge signal={analysis.signal} size="md" strength={analysis.strength} />}
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
                {latestStochK != null && (
                  <IndicatorCard label="Stoch %K" subLabel="Momentum" value={latestStochK} min={0} max={100} color={stochColor} onInfoPress={() => setInfoKey("Stoch %K")} />
                )}
                {latestMfi != null && (
                  <IndicatorCard label="MFI" subLabel="Para Akışı" value={latestMfi} min={0} max={100} color={mfiColor} onInfoPress={() => setInfoKey("MFI")} />
                )}
                {latestAroonOsc != null && (
                  <IndicatorCard
                    label="Aroon"
                    subLabel={`↑${latestAroonUp?.toFixed(0)} ↓${latestAroonDown?.toFixed(0)}`}
                    value={(latestAroonOsc ?? 0) + 100}
                    min={0} max={200}
                    color={
                      (latestAroonOsc ?? 0) > 40 ? colors.up :
                      (latestAroonOsc ?? 0) < -40 ? colors.down : colors.neutral
                    }
                    onInfoPress={() => setInfoKey("Aroon")}
                  />
                )}
              </View>
              <Text style={[styles.indHint, { color: colors.mutedForeground }]}>
                Bu göstergeler birbirini teyit etmek için birlikte kullanılır; hiçbiri tek başına kesin sinyal sayılmaz. Detay için bir göstergeye dokunun.
              </Text>

              <View style={[styles.maRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {latestMa20 != null && (
                  <View style={styles.maItem}>
                    <Text style={[styles.maLabel, { color: colors.mutedForeground }]}>MA 20</Text>
                    <Text style={[styles.maValue, { color: price != null ? (price > latestMa20 ? colors.up : colors.down) : colors.foreground }]}>
                      ₺{latestMa20.toFixed(2)}
                    </Text>
                    <Text style={[styles.maSub, { color: colors.mutedForeground }]}>
                      {price != null ? (price > latestMa20 ? "Üstünde" : "Altında") : ""}
                    </Text>
                  </View>
                )}
                {latestMa50 != null && (
                  <View style={[styles.maItem, latestMa20 != null && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
                    <Text style={[styles.maLabel, { color: colors.mutedForeground }]}>MA 50</Text>
                    <Text style={[styles.maValue, { color: price != null ? (price > latestMa50 ? colors.up : colors.down) : colors.foreground }]}>
                      ₺{latestMa50.toFixed(2)}
                    </Text>
                    <Text style={[styles.maSub, { color: colors.mutedForeground }]}>
                      {price != null ? (price > latestMa50 ? "Üstünde" : "Altında") : ""}
                    </Text>
                  </View>
                )}
                {latestMacd != null && (
                  <View style={[styles.maItem, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
                    <Text style={[styles.maLabel, { color: colors.mutedForeground }]}>MACD</Text>
                    <Text style={[styles.maValue, { color: latestHist != null ? (latestHist > 0 ? colors.up : colors.down) : colors.foreground }]}>
                      {latestMacd.toFixed(2)}
                    </Text>
                    <Text style={[styles.maSub, { color: colors.mutedForeground }]}>
                      Hist: {latestHist?.toFixed(2) ?? "—"}
                    </Text>
                  </View>
                )}
                {latestAtr != null && (
                  <View style={[styles.maItem, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
                    <Text style={[styles.maLabel, { color: colors.mutedForeground }]}>ATR</Text>
                    <Text style={[styles.maValue, { color: price != null && latestAtr / price > 0.03 ? colors.neutral : colors.foreground }]}>
                      ₺{latestAtr.toFixed(2)}
                    </Text>
                    <Text style={[styles.maSub, { color: colors.mutedForeground }]}>Volatilite</Text>
                  </View>
                )}
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

        {/* Candle Patterns */}
        {!loadingChart && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mum Formasyonu</Text>
            <View style={styles.candleHeaderRow}>
              <View style={[styles.candleDirBadge, { backgroundColor: `${candleDirColor}20`, borderColor: `${candleDirColor}44` }]}>
                <Text style={[styles.candleDirLabel, { color: candleDirColor }]}>{candleDirLabel}</Text>
              </View>
              <Text style={[styles.candleSubtext, { color: colors.mutedForeground }]}>
                {candlePatterns.length === 0 ? "Net formasyon yok" : `${candlePatterns.length} formasyon`}
              </Text>
            </View>
            {candlePatterns.map((p, i) => (
              <View key={i} style={[styles.candleRow, { borderBottomColor: colors.border }]}>
                <Text style={styles.candleEmoji}>{p.emoji}</Text>
                <Text style={[styles.candleName, { color: colors.foreground }]}>{p.name}</Text>
                <View style={[styles.candleDirPill, {
                  backgroundColor: `${p.direction === "bullish" ? colors.up : p.direction === "bearish" ? colors.down : colors.neutral}20`
                }]}>
                  <Text style={[styles.candleDirText, {
                    color: p.direction === "bullish" ? colors.up : p.direction === "bearish" ? colors.down : colors.neutral
                  }]}>
                    {p.direction === "bullish" ? "↑ Yükseliş" : p.direction === "bearish" ? "↓ Düşüş" : "→ Nötr"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Signal Reasons */}
        {analysis && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sinyal Gerekçeleri</Text>
            {analysis.reasons.map((r, i) => {
              const iconColor = analysis.signal === "buy" ? colors.up :
                analysis.signal === "sell" ? colors.down : colors.neutral;
              return (
                <View key={i} style={styles.reasonRow}>
                  {analysis.signal === "buy"
                    ? <IconCheck color={iconColor} size={16} />
                    : analysis.signal === "sell"
                    ? <IconClose color={iconColor} size={16} />
                    : <IconMinus color={iconColor} size={16} />
                  }
                  <Text style={[styles.reasonText, { color: colors.mutedForeground }]}>{r}</Text>
                </View>
              );
            })}
            {!analysis.volumeConfirmed && (
              <View style={styles.reasonRow}>
                <IconMinus color={colors.mutedForeground} size={16} />
                <Text style={[styles.reasonText, { color: colors.mutedForeground }]}>
                  Hacim teyidi yok, sinyal gücü sınırlı olabilir.
                </Text>
              </View>
            )}
            <View style={[styles.adviceBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.adviceLabel, { color: colors.foreground }]}>Ne Yapılmalı?</Text>
              <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
                {getActionAdvice(analysis)}
              </Text>
            </View>
          </View>
        )}

        {/* Risk Management */}
        {analysis && analysis.signal !== "neutral" && !isNaN(analysis.stopLoss) && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Risk Yönetimi (ATR Bazlı)</Text>
            <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.riskRow}>
                <Text style={[styles.riskLabel, { color: colors.mutedForeground }]}>Zarar Kes</Text>
                <Text style={[styles.riskValue, { color: colors.down }]}>₺{analysis.stopLoss.toFixed(2)}</Text>
              </View>
              <View style={styles.riskRow}>
                <Text style={[styles.riskLabel, { color: colors.mutedForeground }]}>Kar Al Hedefi</Text>
                <Text style={[styles.riskValue, { color: colors.up }]}>₺{analysis.takeProfit.toFixed(2)}</Text>
              </View>
              {!isNaN(analysis.riskRewardRatio) && (
                <View style={styles.riskRow}>
                  <Text style={[styles.riskLabel, { color: colors.mutedForeground }]}>Risk/Ödül Oranı</Text>
                  <Text style={[styles.riskValue, { color: colors.foreground }]}>1 : {analysis.riskRewardRatio.toFixed(2)}</Text>
                </View>
              )}
              <Text style={[styles.reportText, { color: colors.mutedForeground, marginTop: 6 }]}>
                Bu seviyeler ATR (Average True Range) volatilitesine göre hesaplanan referans noktalarıdır, kesin garanti sunmaz. Pozisyon büyüklüğünüzü zarar kesme mesafesine göre ayarlayın.
              </Text>
            </View>
          </View>
        )}

        {/* Signal Performance Tracking */}
        {backtest && (backtest.buySignalCount > 0 || backtest.sellSignalCount > 0) && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sinyal Performans Takibi</Text>
            <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.reportText, { color: colors.mutedForeground, marginBottom: 8 }]}>
                Son 6 ayda bu hissede üretilen AL/SAT sinyallerinin {backtest.horizonDays} gün sonrasında ne kadar isabetli çıktığı:
              </Text>
              {backtest.buySignalCount > 0 && (
                <View style={styles.riskRow}>
                  <Text style={[styles.riskLabel, { color: colors.mutedForeground }]}>
                    AL sinyalleri ({backtest.buySignalCount} adet)
                  </Text>
                  <Text style={[styles.riskValue, { color: backtest.buyWinRate >= 50 ? colors.up : colors.down }]}>
                    %{backtest.buyWinRate.toFixed(0)} isabet
                  </Text>
                </View>
              )}
              {backtest.sellSignalCount > 0 && (
                <View style={styles.riskRow}>
                  <Text style={[styles.riskLabel, { color: colors.mutedForeground }]}>
                    SAT sinyalleri ({backtest.sellSignalCount} adet)
                  </Text>
                  <Text style={[styles.riskValue, { color: backtest.sellWinRate >= 50 ? colors.up : colors.down }]}>
                    %{backtest.sellWinRate.toFixed(0)} isabet
                  </Text>
                </View>
              )}
              <Text style={[styles.reportText, { color: colors.mutedForeground, marginTop: 6 }]}>
                Bu, sadece bu hissenin kendi geçmiş verisine dayanan bir istatistiktir; az sayıda sinyal varsa güvenilirliği düşer ve geçmiş performans gelecek için garanti oluşturmaz.
              </Text>
            </View>
          </View>
        )}

        {/* Morning Report */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sabah Raporu</Text>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
              {morningReport}
            </Text>
          </View>
        </View>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aktif Alarmlar</Text>
            {activeAlerts.map((a) => (
              <View key={a.id} style={[styles.alertChip, { backgroundColor: `${colors.neutral}15`, borderColor: `${colors.neutral}30` }]}>
                <IconNotifications color={colors.neutral} size={13} />
                <Text style={[styles.alertChipText, { color: colors.mutedForeground }]}>
                  {a.alertType === "tp" ? "Kar Al" :
                   a.alertType === "sl" ? "Zarar Kes" :
                   a.alertType === "above" ? "Üstünde" : "Altında"}: ₺{a.targetPrice.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
        {existingEntry && (
          <View style={[styles.portfolioChip, { backgroundColor: `${colors.up}18`, borderColor: `${colors.up}40` }]}>
            <Text style={[styles.portfolioChipText, { color: colors.up }]}>
              Portföyde: {existingEntry.quantity} adet · ₺{existingEntry.avgPrice.toFixed(2)} ort.
            </Text>
          </View>
        )}
        <Pressable
          style={[styles.addBtn, { backgroundColor: existingEntry ? colors.secondary : colors.primary }]}
          onPress={handleOpenPortfolioModal}
        >
          <Text style={[styles.addBtnText, { color: existingEntry ? colors.foreground : "#fff" }]}>
            {existingEntry ? "Pozisyonu Güncelle" : "Portföye Ekle"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.watchBtn, { backgroundColor: watched ? `${colors.up}18` : colors.secondary, borderColor: watched ? `${colors.up}40` : colors.border }]}
          onPress={handleTakibeAl}
          disabled={watched}
        >
          <Text style={[styles.watchBtnText, { color: watched ? colors.up : colors.mutedForeground }]}>
            {watched ? "Piyasa Listesinde ✓" : "Takibe Al"}
          </Text>
        </Pressable>
      </View>

      {/* ── Portfolio Modal ── */}
      <Modal
        visible={showPortfolioModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPortfolioModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                    {existingEntry ? "Pozisyonu Güncelle" : "Portföye Ekle"}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{symbol}</Text>
                </View>
                <Pressable onPress={() => setShowPortfolioModal(false)} hitSlop={12}
                  style={[styles.modalCloseBtn, { backgroundColor: colors.secondary }]}>
                  <IconX color={colors.mutedForeground} size={15} />
                </Pressable>
              </View>

              {/* Current price pill */}
              {price != null && (
                <View style={[styles.priceInfoPill, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.priceInfoText, { color: colors.mutedForeground }]}>Anlık fiyat: </Text>
                  <Text style={[styles.priceInfoVal, { color: changeColor }]}>₺{price.toFixed(2)}</Text>
                  {change != null && (
                    <Text style={[styles.priceInfoChange, { color: changeColor }]}>
                      {" "}({change >= 0 ? "+" : ""}{change.toFixed(2)}%)
                    </Text>
                  )}
                </View>
              )}

              {/* Adet */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Adet</Text>
                <TextInput
                  ref={qtyRef}
                  style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  placeholder="Kaç lot?"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="next"
                />
              </View>

              {/* Ortalama maliyet */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Ortalama Maliyet (₺)</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={avgCostStr}
                  onChangeText={setAvgCostStr}
                  keyboardType="decimal-pad"
                  placeholder={price != null ? `${price.toFixed(2)}` : "0.00"}
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                />
              </View>

              {/* Toplam maliyet önizleme */}
              {qty !== "" && avgCostStr !== "" && !isNaN(parseFloat(qty)) && !isNaN(parseFloat(avgCostStr)) && (
                <View style={[styles.totalRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Toplam Maliyet</Text>
                  <Text style={[styles.totalVal, { color: colors.foreground }]}>
                    ₺{(parseFloat(qty) * parseFloat(avgCostStr)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              {/* Not */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Not (isteğe bağlı)</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Alış gerekçesi..."
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                />
              </View>

              <Pressable
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSavePortfolio}
              >
                <Text style={styles.saveBtnText}>
                  {existingEntry ? "Güncelle" : "Portföye Ekle"}
                </Text>
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
  adviceBox: { borderRadius: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 4, gap: 4 },
  adviceLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
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
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 8,
  },
  maItem: { flex: 1, padding: 12, alignItems: "center" },
  maLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  maValue: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 2 },
  maSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  candleHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  candleDirBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  candleDirLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  candleSubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  candleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  candleEmoji: { fontSize: 18, width: 26 },
  candleName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  candleDirPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  candleDirText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  reasonText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  reportCard: { borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  reportText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21 },
  riskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  riskLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  riskValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
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
  alertChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  root: { flex: 1 },
  bottomBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  portfolioChip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    alignItems: "center",
  },
  portfolioChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  watchBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
  },
  watchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
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
