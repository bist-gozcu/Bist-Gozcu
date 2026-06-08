import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAlerts } from "@/contexts/AlertContext";
import { fetchChartData, ChartResult, ChartRange, getMarketSession } from "@/utils/yahooFinance";
import {
  analyzeStock,
  AnalysisResult,
  macd,
  rsi,
  sma,
  moneyFlowIndex,
  detectCandlePatterns,
  getOverallCandleDirection,
  CandlePattern,
} from "@/utils/indicators";
import { getStockMeta } from "@/constants/bistStocks";
import SignalBadge from "@/components/SignalBadge";
import PriceChart from "@/components/PriceChart";

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

function IndicatorBar({ label, value, min, max, color }: {
  label: string; value: number; min: number; max: number; color: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <View style={styles.indBar}>
      <View style={styles.indBarTop}>
        <Text style={[styles.indLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.indValue, { color }]}>{isNaN(value) ? "—" : value.toFixed(1)}</Text>
      </View>
      <View style={[styles.indTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.indFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function StockDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { quotes } = useStocks();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { alerts } = useAlerts();
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [candlePatterns, setCandlePatterns] = useState<CandlePattern[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [range, setRange] = useState<ChartRange>("3mo");

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

  const handleFav = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol ?? "");
    else addFavorite(symbol ?? "");
  };

  const handleRangeChange = (r: ChartRange) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setRange(r);
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
  const macdData   = chart && n >= 26 ? macd(chart.closes) : null;
  const rsiData    = chart && n >= 14 ? rsi(chart.closes) : null;
  const mfiData    = chart && n >= 14 ? moneyFlowIndex(chart.highs, chart.lows, chart.closes, chart.volumes) : null;
  const ma20Data   = chart && n >= 20 ? sma(chart.closes, 20) : null;
  const ma50Data   = chart && n >= 50 ? sma(chart.closes, 50) : null;
  const latestMacd = macdData?.macd[n - 1];
  const latestHist = macdData?.histogram[n - 1];
  const latestRsi  = rsiData?.[n - 1];
  const latestMfi  = mfiData?.[n - 1];
  const latestMa20 = ma20Data?.[n - 1];
  const latestMa50 = ma50Data?.[n - 1];

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
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    return avgReturn * 100;
  })();

  const activeAlerts = alerts.filter((a) => a.symbol === symbol && !a.triggered);

  const sessionLabel =
    session === "open" ? "Açık" :
    session === "pre" ? "Açılış öncesi" :
    session === "post" ? "Kapanış sonrası" : "Kapalı";

  return (
    <>
      <Stack.Screen
        options={{
          title: symbol ?? "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_700Bold" },
          headerRight: () => (
            <Pressable onPress={handleFav} hitSlop={8} style={{ marginRight: 4 }}>
              <Ionicons
                name={fav ? "star" : "star-outline"}
                size={20}
                color={fav ? colors.neutral : colors.mutedForeground}
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Price Header */}
        <View style={[styles.priceSection, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.companyName, { color: colors.mutedForeground }]}>
              {meta?.name ?? symbol}
            </Text>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {price != null ? `₺${price.toFixed(2)}` : "—"}
            </Text>
            <View style={styles.changeRow}>
              <Text style={[styles.changeAbs, { color: changeColor }]}>
                {changeVal != null ? `${changeVal >= 0 ? "+" : ""}₺${changeVal.toFixed(2)}` : ""}
              </Text>
              <Text style={[styles.changePct, { color: changeColor }]}>
                {change != null ? `(${change >= 0 ? "+" : ""}${change.toFixed(2)}%)` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.signalArea}>
            {analysis && <SignalBadge signal={analysis.signal} size="md" />}
            <View style={styles.sessionRow}>
              <View style={[styles.sessionDot, { backgroundColor: session === "open" ? colors.up : colors.mutedForeground }]} />
              <Text style={[styles.sessionText, { color: colors.mutedForeground }]}>{sessionLabel}</Text>
            </View>
          </View>
        </View>

        {/* Range Selector */}
        <View style={[styles.rangeRow, { borderBottomColor: colors.border }]}>
          {RANGES.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[
                styles.rangeBtn,
                { backgroundColor: range === key ? colors.primary : "transparent" },
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

        {/* Price Chart */}
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
          <StatRow label="Açılış"         value={`₺${formatNum(quote?.regularMarketOpen)}`} />
          <StatRow label="Gün Yüksek"     value={`₺${formatNum(quote?.regularMarketDayHigh)}`}   valueColor={colors.up} />
          <StatRow label="Gün Düşük"      value={`₺${formatNum(quote?.regularMarketDayLow)}`}    valueColor={colors.down} />
          <StatRow label="Önceki Kapanış" value={`₺${formatNum(quote?.regularMarketPreviousClose)}`} />
          <StatRow label="52H Yüksek"     value={`₺${formatNum(quote?.fiftyTwoWeekHigh)}`}       valueColor={colors.up} />
          <StatRow label="52H Düşük"      value={`₺${formatNum(quote?.fiftyTwoWeekLow)}`}        valueColor={colors.down} />
          <StatRow label="Piyasa Değeri"  value={formatBig(quote?.marketCap)} />
          <StatRow label="Günlük Hacim"   value={formatBig(quote?.regularMarketVolume)} />
        </View>

        {/* Technical Analysis */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teknik Analiz</Text>
          {loadingChart ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
          ) : (
            <>
              <IndicatorBar
                label="RSI (14) — Aşırı Al/Sat"
                value={latestRsi ?? NaN}
                min={0} max={100}
                color={
                  latestRsi == null ? colors.mutedForeground :
                  latestRsi < 30 ? colors.up :
                  latestRsi > 70 ? colors.down : colors.neutral
                }
              />
              <IndicatorBar
                label="MFI (14) — Para Akışı"
                value={latestMfi ?? NaN}
                min={0} max={100}
                color={
                  latestMfi == null ? colors.mutedForeground :
                  latestMfi < 20 ? colors.up :
                  latestMfi > 80 ? colors.down : colors.neutral
                }
              />
              <StatRow
                label="MACD"
                value={latestMacd != null ? latestMacd.toFixed(3) : "—"}
                valueColor={latestHist != null ? (latestHist > 0 ? colors.up : colors.down) : undefined}
              />
              {latestMa20 != null && (
                <StatRow
                  label="MA 20"
                  value={`₺${latestMa20.toFixed(2)}`}
                  valueColor={price != null ? (price > latestMa20 ? colors.up : colors.down) : undefined}
                />
              )}
              {latestMa50 != null && (
                <StatRow
                  label="MA 50"
                  value={`₺${latestMa50.toFixed(2)}`}
                  valueColor={price != null ? (price > latestMa50 ? colors.up : colors.down) : undefined}
                />
              )}
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

        {/* Candle Pattern Analysis */}
        {!loadingChart && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mum Formasyonu</Text>
            <View style={styles.candleDirRow}>
              <View style={[styles.candleDirBadge, { backgroundColor: `${candleDirColor}22`, borderColor: `${candleDirColor}44` }]}>
                <Text style={[styles.candleDirLabel, { color: candleDirColor }]}>
                  {candleDirLabel}
                </Text>
              </View>
              <Text style={[styles.candleSubtext, { color: colors.mutedForeground }]}>
                {candlePatterns.length === 0
                  ? "Net formasyon yok"
                  : `${candlePatterns.length} formasyon tespit edildi`}
              </Text>
            </View>
            {candlePatterns.map((p, i) => (
              <View key={i} style={styles.candleRow}>
                <Text style={[styles.candleEmoji]}>{p.emoji}</Text>
                <Text style={[styles.candleName, { color: colors.foreground }]}>{p.name}</Text>
                <Text style={[
                  styles.candleDir,
                  {
                    color: p.direction === "bullish" ? colors.up :
                           p.direction === "bearish" ? colors.down : colors.neutral
                  }
                ]}>
                  {p.direction === "bullish" ? "↑ Yükseliş" :
                   p.direction === "bearish" ? "↓ Düşüş" : "→ Nötr"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Signal Reasons */}
        {analysis && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sinyal Gerekçeleri</Text>
            {analysis.reasons.map((r, i) => (
              <View key={i} style={styles.reasonRow}>
                <Ionicons
                  name={
                    analysis.signal === "buy" ? "checkmark-circle" :
                    analysis.signal === "sell" ? "close-circle" : "remove-circle"
                  }
                  size={14}
                  color={
                    analysis.signal === "buy" ? colors.up :
                    analysis.signal === "sell" ? colors.down : colors.neutral
                  }
                />
                <Text style={[styles.reasonText, { color: colors.mutedForeground }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Morning Report */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sabah Raporu</Text>
          <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
            {!analysis || !price
              ? "Veri yükleniyor..."
              : [
                  `${symbol} için sabah analizi:`,
                  analysis.signal === "buy"
                    ? "Teknik göstergeler ALIM sinyali veriyor."
                    : analysis.signal === "sell"
                    ? "Teknik göstergeler SATIM sinyali veriyor."
                    : "Teknik göstergeler nötr, bekle-izle.",
                  latestMa20 != null
                    ? price > latestMa20
                      ? "Fiyat 20 günlük ortalama üstünde."
                      : "Fiyat 20 günlük ortalama altında."
                    : "",
                  latestMa20 != null && latestMa50 != null
                    ? latestMa20 > latestMa50
                      ? "Yükseliş trendi devam ediyor."
                      : "Düşüş trendi sürebilir."
                    : "",
                  candlePatterns.length > 0
                    ? `Mum analizi ${candleDirLabel.toLowerCase()} yönü işaret ediyor (${candlePatterns[0].name}).`
                    : "",
                  volatility != null && volatility > 2
                    ? `Volatilite yüksek (%${volatility.toFixed(1)}), dikkatli işlem yapın.`
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n")}
          </Text>
        </View>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aktif Alarmlar</Text>
            {activeAlerts.map((a) => (
              <View key={a.id} style={styles.alertChip}>
                <Ionicons name="notifications" size={13} color={colors.neutral} />
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  companyName: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  price: { fontSize: 32, fontFamily: "Inter_700Bold" },
  changeRow: { flexDirection: "row", gap: 4, marginTop: 4 },
  changeAbs: { fontSize: 14, fontFamily: "Inter_500Medium" },
  changePct: { fontSize: 14, fontFamily: "Inter_500Medium" },
  signalArea: { alignItems: "flex-end", gap: 8, marginTop: 4 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  sessionText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  rangeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chartLoader: { height: 236, alignItems: "center", justifyContent: "center" },
  section: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  statLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  indBar: { marginBottom: 12 },
  indBarTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  indLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  indValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  indTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  indFill: { height: "100%", borderRadius: 2 },
  candleDirRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  candleDirBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  candleDirLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  candleSubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  candleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  candleEmoji: { fontSize: 16, width: 24 },
  candleName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  candleDir: { fontSize: 12, fontFamily: "Inter_500Medium" },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  reasonText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  reportText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  alertChip: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  alertChipText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
