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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAlerts } from "@/contexts/AlertContext";
import { fetchChartData, ChartResult, getMarketSession } from "@/utils/yahooFinance";
import { analyzeStock, AnalysisResult, macd, rsi, sma, moneyFlowIndex } from "@/utils/indicators";
import { getStockMeta } from "@/constants/bistStocks";
import SignalBadge from "@/components/SignalBadge";

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function IndicatorBar({ label, value, min, max, color }: { label: string; value: number; min: number; max: number; color: string }) {
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
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { quotes } = useStocks();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { alerts } = useAlerts();
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [range, setRange] = useState<"1mo" | "3mo" | "6mo" | "1y">("3mo");

  const quote = quotes[symbol ?? ""];
  const meta = getStockMeta(symbol ?? "");
  const fav = isFavorite(symbol ?? "");
  const session = getMarketSession();

  useEffect(() => {
    if (!symbol) return;
    setLoadingChart(true);
    fetchChartData(symbol, range).then((data) => {
      setChart(data);
      if (data && data.closes.length >= 30) {
        const result = analyzeStock(data.closes, data.highs, data.lows, data.volumes);
        setAnalysis(result);
      }
      setLoadingChart(false);
    });
  }, [symbol, range]);

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fav) removeFavorite(symbol ?? "");
    else addFavorite(symbol ?? "");
  };

  const price = quote?.regularMarketPrice;
  const change = quote?.regularMarketChangePercent;
  const changeVal = quote?.regularMarketChange;
  const changeColor =
    change == null ? colors.mutedForeground :
    change > 0 ? colors.up :
    change < 0 ? colors.down :
    colors.neutral;

  const formatNum = (n?: number) => n != null ? n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—";
  const formatBig = (n?: number) => {
    if (!n) return "—";
    if (n >= 1e12) return `₺${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `₺${(n / 1e9).toFixed(2)}Mr`;
    if (n >= 1e6) return `₺${(n / 1e6).toFixed(2)}M`;
    return `₺${n.toLocaleString("tr-TR")}`;
  };

  const macdData = chart ? macd(chart.closes) : null;
  const rsiData = chart ? rsi(chart.closes) : null;
  const mfiData = chart ? moneyFlowIndex(chart.highs, chart.lows, chart.closes, chart.volumes) : null;
  const ma20Data = chart ? sma(chart.closes, 20) : null;
  const ma50Data = chart ? sma(chart.closes, 50) : null;
  const n = chart?.closes.length ?? 0;
  const latestMacd = macdData?.macd[n - 1];
  const latestMacdHist = macdData?.histogram[n - 1];
  const latestRsi = rsiData?.[n - 1];
  const latestMfi = mfiData?.[n - 1];
  const latestMa20 = ma20Data?.[n - 1];
  const latestMa50 = ma50Data?.[n - 1];

  const morningReport = () => {
    if (!analysis || !price) return "Veri yükleniyor...";
    const lines: string[] = [];
    lines.push(`${symbol} için sabah analizi:`);
    if (analysis.signal === "buy") lines.push("Teknik göstergeler ALIM sinyali veriyor.");
    else if (analysis.signal === "sell") lines.push("Teknik göstergeler SATIM sinyali veriyor.");
    else lines.push("Teknik göstergeler nötr, bekle-izle.");
    if (!isNaN(analysis.ma20) && !isNaN(analysis.ma50)) {
      lines.push(price > analysis.ma20 ? "Fiyat 20 günlük ortalama üstünde." : "Fiyat 20 günlük ortalama altında.");
      lines.push(analysis.ma20 > analysis.ma50 ? "Yükseliş trendi devam ediyor." : "Düşüş trendi sürebilir.");
    }
    return lines.join("\n");
  };

  const activeAlerts = alerts.filter((a) => a.symbol === symbol && !a.triggered);

  const rangeOptions: ("1mo" | "3mo" | "6mo" | "1y")[] = ["1mo", "3mo", "6mo", "1y"];
  const rangeLabels = { "1mo": "1A", "3mo": "3A", "6mo": "6A", "1y": "1Y" };

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
              <Feather name="star" size={20} color={fav ? colors.neutral : colors.mutedForeground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
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
            <View style={[styles.sessionDot, { backgroundColor: session === "open" ? colors.up : colors.mutedForeground }]} />
            <Text style={[styles.sessionText, { color: colors.mutedForeground }]}>
              {session === "open" ? "Açık" : session === "pre" ? "Açılış öncesi" : session === "post" ? "Kapanış sonrası" : "Kapalı"}
            </Text>
          </View>
        </View>

        <View style={[styles.rangeRow, { borderBottomColor: colors.border }]}>
          {rangeOptions.map((r) => (
            <Pressable
              key={r}
              style={[styles.rangeBtn, { backgroundColor: range === r ? colors.primary : "transparent" }]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeBtnText, { color: range === r ? "#fff" : colors.mutedForeground }]}>
                {rangeLabels[r]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fiyat Bilgisi</Text>
          <StatRow label="Açılış" value={`₺${formatNum(quote?.regularMarketOpen)}`} />
          <StatRow label="Gün Yüksek" value={`₺${formatNum(quote?.regularMarketDayHigh)}`} valueColor={colors.up} />
          <StatRow label="Gün Düşük" value={`₺${formatNum(quote?.regularMarketDayLow)}`} valueColor={colors.down} />
          <StatRow label="Önceki Kapanış" value={`₺${formatNum(quote?.regularMarketPreviousClose)}`} />
          <StatRow label="52H Yüksek" value={`₺${formatNum(quote?.fiftyTwoWeekHigh)}`} valueColor={colors.up} />
          <StatRow label="52H Düşük" value={`₺${formatNum(quote?.fiftyTwoWeekLow)}`} valueColor={colors.down} />
          <StatRow label="Piyasa Değeri" value={formatBig(quote?.marketCap)} />
          <StatRow label="Günlük Hacim" value={formatBig(quote?.regularMarketVolume)} />
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teknik Analiz</Text>
          {loadingChart ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
          ) : (
            <>
              <IndicatorBar
                label={`RSI (14)`}
                value={latestRsi ?? NaN}
                min={0}
                max={100}
                color={
                  latestRsi == null ? colors.mutedForeground :
                  latestRsi < 30 ? colors.up :
                  latestRsi > 70 ? colors.down :
                  colors.neutral
                }
              />
              <IndicatorBar
                label={`MFI (14)`}
                value={latestMfi ?? NaN}
                min={0}
                max={100}
                color={
                  latestMfi == null ? colors.mutedForeground :
                  latestMfi < 20 ? colors.up :
                  latestMfi > 80 ? colors.down :
                  colors.neutral
                }
              />
              <StatRow
                label="MACD"
                value={latestMacd != null ? latestMacd.toFixed(3) : "—"}
                valueColor={latestMacdHist != null ? (latestMacdHist > 0 ? colors.up : colors.down) : undefined}
              />
              <StatRow
                label="MA 20"
                value={latestMa20 != null ? `₺${latestMa20.toFixed(2)}` : "—"}
                valueColor={price != null && latestMa20 != null ? (price > latestMa20 ? colors.up : colors.down) : undefined}
              />
              <StatRow
                label="MA 50"
                value={latestMa50 != null ? `₺${latestMa50.toFixed(2)}` : "—"}
                valueColor={price != null && latestMa50 != null ? (price > latestMa50 ? colors.up : colors.down) : undefined}
              />
            </>
          )}
        </View>

        {analysis && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sinyal Gerekçeleri</Text>
            {analysis.reasons.map((r, i) => (
              <View key={i} style={styles.reasonRow}>
                <Feather
                  name={analysis.signal === "buy" ? "check-circle" : analysis.signal === "sell" ? "x-circle" : "circle"}
                  size={14}
                  color={analysis.signal === "buy" ? colors.up : analysis.signal === "sell" ? colors.down : colors.neutral}
                />
                <Text style={[styles.reasonText, { color: colors.mutedForeground }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sabah Raporu</Text>
          <Text style={[styles.reportText, { color: colors.mutedForeground }]}>{morningReport()}</Text>
        </View>

        {activeAlerts.length > 0 && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aktif Alarmlar</Text>
            {activeAlerts.map((a) => (
              <View key={a.id} style={styles.alertChip}>
                <Feather name="bell" size={13} color={colors.neutral} />
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
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  sessionText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  rangeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  reasonText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  reportText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  alertChip: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  alertChipText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
