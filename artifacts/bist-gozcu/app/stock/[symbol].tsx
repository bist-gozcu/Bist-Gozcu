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
  atr,
  stochastic,
  aroon,
  detectCandlePatterns,
  getOverallCandleDirection,
  CandlePattern,
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

function IndicatorCard({ label, value, subLabel, min, max, color }: {
  label: string;
  subLabel?: string;
  value: number;
  min: number;
  max: number;
  color: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  const displayVal = isNaN(value) ? "—" : value.toFixed(1);
  return (
    <View style={[styles.indCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.indCardTop}>
        <View style={styles.indCardLeft}>
          <Text style={[styles.indLabel, { color: colors.foreground }]}>{label}</Text>
          {subLabel && <Text style={[styles.indSub, { color: colors.mutedForeground }]}>{subLabel}</Text>}
        </View>
        <Text style={[styles.indValue, { color }]}>{displayVal}</Text>
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
    <>
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
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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
            {analysis && <SignalBadge signal={analysis.signal} size="md" />}
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
                  <IndicatorCard label="RSI" subLabel="Aşırı Al/Sat" value={latestRsi} min={0} max={100} color={rsiColor} />
                )}
                {latestStochK != null && (
                  <IndicatorCard label="Stoch %K" subLabel="Momentum" value={latestStochK} min={0} max={100} color={stochColor} />
                )}
                {latestMfi != null && (
                  <IndicatorCard label="MFI" subLabel="Para Akışı" value={latestMfi} min={0} max={100} color={mfiColor} />
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
                  />
                )}
              </View>

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
          </View>
        )}

        {/* Morning Report */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sabah Raporu</Text>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    </>
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
});
