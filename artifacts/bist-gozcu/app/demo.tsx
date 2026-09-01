import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useDemo, DemoPosition } from "@/contexts/DemoContext";
import { useStocks } from "@/contexts/StockContext";

const money = (value: number) =>
  `₺${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const signalLabel: Record<DemoPosition["signalType"], string> = {
  erken_hareket: "Erken Hareket",
  gun_ici_izleme: "Gün İçi İzleme",
  gunluk_teyitli: "Günlük Teyitli",
  cekirge_adayi: "Çekirge Adayı",
};

const dateLabel = (timestamp?: number) =>
  timestamp
    ? new Date(timestamp).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function OpenPosition({
  position,
  price,
  onClose,
}: {
  position: DemoPosition;
  price: number | undefined;
  onClose: () => void;
}) {
  const colors = useColors();
  const marketPrice = price ?? position.entryPrice;
  const marketValue = marketPrice * position.quantity;
  const pnl =
    marketValue - position.quantity * position.entryPrice - position.entryFee;
  const pnlPct =
    position.entryPrice > 0
      ? (pnl / (position.quantity * position.entryPrice)) * 100
      : 0;
  const pnlColor = pnl >= 0 ? colors.up : colors.down;

  return (
    <View
      style={[
        styles.tradeCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.tradeHeader}>
        <View>
          <View style={styles.symbolLine}>
            <Text style={[styles.symbol, { color: colors.foreground }]}>
              {position.symbol}
            </Text>
            <Text style={[styles.marketPrice, { color: colors.foreground }]}>
              Son: {money(marketPrice)}
            </Text>
          </View>
          <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
            {signalLabel[position.signalType]} · {position.confirmations}/6
            teyit
          </Text>
        </View>
        <Text style={[styles.pnl, { color: pnlColor }]}>{percent(pnlPct)}</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Giriş fiyatı (₺)
          </Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {money(position.entryPrice)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Lot adedi
          </Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {position.quantity.toLocaleString("tr-TR")} lot
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Pozisyon değeri (₺)
          </Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {money(marketValue)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Kâr / zarar (₺)
          </Text>
          <Text style={[styles.value, { color: pnlColor }]}>{money(pnl)}</Text>
        </View>
      </View>
      <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
        Giriş: {dateLabel(position.entryAt)}
      </Text>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [
          styles.closeButton,
          {
            backgroundColor: pressed ? `${colors.down}30` : `${colors.down}18`,
          },
        ]}
      >
        <Text style={[styles.closeButtonText, { color: colors.down }]}>
          Sanal satışı kapat
        </Text>
      </Pressable>
    </View>
  );
}

function ClosedTrade({ position }: { position: DemoPosition }) {
  const colors = useColors();
  const pnl = position.realizedPnl ?? 0;
  return (
    <View style={[styles.closedRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.closedSymbol, { color: colors.foreground }]}>
          {position.symbol}
        </Text>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
          {signalLabel[position.signalType]} ·{" "}
          {position.exitReason ?? "Sanal satış"}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={[
            styles.closedPnl,
            { color: pnl >= 0 ? colors.up : colors.down },
          ]}
        >
          {pnl >= 0 ? "+" : ""}
          {money(pnl)}
        </Text>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
          {dateLabel(position.exitAt)}
        </Text>
      </View>
    </View>
  );
}

export default function DemoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account, loading, closePosition, resetAccount } = useDemo();
  const { quotes } = useStocks();
  const [reportPeriod, setReportPeriod] = useState<
    "gunluk" | "haftalik" | "aylik"
  >("gunluk");
  const periodDays =
    reportPeriod === "gunluk" ? 1 : reportPeriod === "haftalik" ? 7 : 30;
  const periodStart = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const todaySnapshots = account.signalSnapshots.filter(
    (snapshot) => snapshot.signalAt >= periodStart,
  );
  const reportClosedTrades = account.closedTrades.filter(
    (trade) => (trade.exitAt ?? 0) >= periodStart,
  );

  const values = useMemo(() => {
    const openValue = account.positions.reduce(
      (sum, position) =>
        sum +
        (quotes[position.symbol]?.regularMarketPrice ?? position.entryPrice) *
          position.quantity,
      0,
    );
    const equity = account.cash + openValue;
    const realized = account.closedTrades.reduce(
      (sum, trade) => sum + (trade.realizedPnl ?? 0),
      0,
    );
    const wins = account.closedTrades.filter(
      (trade) => (trade.realizedPnl ?? 0) > 0,
    ).length;
    const winRate =
      account.closedTrades.length > 0
        ? (wins / account.closedTrades.length) * 100
        : 0;
    return {
      openValue,
      equity,
      realized,
      winRate,
      total: equity - account.initialBalance,
    };
  }, [account, quotes]);

  const handleClose = (position: DemoPosition) => {
    const price = quotes[position.symbol]?.regularMarketPrice;
    if (!price) {
      Alert.alert("Fiyat yok", "Güncel fiyat alınmadan sanal satış yapılamaz.");
      return;
    }
    Alert.alert(
      "Sanal satışı onayla",
      `${position.symbol} için ${money(price)} seviyesinden sanal satış yapılsın mı?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sanal sat",
          style: "destructive",
          onPress: () =>
            closePosition(position.id, price, "Kullanıcı sanal satışı"),
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      "Demo hesabını sıfırla",
      "Tüm sanal pozisyonlar ve işlemler silinecek. Devam edilsin mi?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Sıfırla", style: "destructive", onPress: resetAccount },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Demo Hesabı
          </Text>
          <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
            Yalnızca sanal para ile test
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.backText, { color: colors.foreground }]}>
            Geri
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.warning,
          {
            backgroundColor: `${colors.neutral}18`,
            borderColor: `${colors.neutral}55`,
          },
        ]}
      >
        <Text style={[styles.warningText, { color: colors.neutral }]}>
          Gerçek emir gönderilmez. Sonuçlar yalnızca sinyal kalitesini test
          eder.
        </Text>
      </View>

      {account.morningCandidates.length > 0 ? (
        <View
          style={[
            styles.reportCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.reportTitle, { color: colors.foreground }]}>
            Sabah açılış adayları
          </Text>
          <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
            Akşam kapanışında şartları sağlayan hisseler
          </Text>
          {account.morningCandidates.map((candidate) => (
            <View
              key={candidate.id}
              style={[styles.reportRow, { borderBottomColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.closedSymbol, { color: colors.foreground }]}
                >
                  {candidate.symbol}
                </Text>
                <Text
                  style={[styles.subtle, { color: colors.mutedForeground }]}
                >
                  {candidate.reason}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.value, { color: colors.foreground }]}>
                  {money(candidate.closePrice)}
                </Text>
                <Text
                  style={[styles.subtle, { color: colors.mutedForeground }]}
                >
                  Bekliyor
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.reportCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.reportTitle, { color: colors.foreground }]}>
          Hareket ve işlem raporu
        </Text>
        <View style={styles.periodTabs}>
          {(["gunluk", "haftalik", "aylik"] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setReportPeriod(period)}
              style={[
                styles.periodTab,
                {
                  backgroundColor:
                    reportPeriod === period ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    reportPeriod === period
                      ? colors.background
                      : colors.foreground,
                  fontSize: 11,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {period === "gunluk"
                  ? "Günlük"
                  : period === "haftalik"
                    ? "Haftalık"
                    : "Aylık"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
          {todaySnapshots.length} sinyal · {reportClosedTrades.length} kapanan
          işlem
        </Text>
        {todaySnapshots.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Bugün kaydedilmiş sinyal yok.
          </Text>
        ) : (
          todaySnapshots
            .slice()
            .reverse()
            .map((snapshot) => {
              const current = quotes[snapshot.symbol]?.regularMarketPrice;
              const move =
                current && snapshot.signalPrice > 0
                  ? ((current - snapshot.signalPrice) / snapshot.signalPrice) *
                    100
                  : null;
              return (
                <View
                  key={snapshot.id}
                  style={[
                    styles.reportRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.closedSymbol,
                        { color: colors.foreground },
                      ]}
                    >
                      {snapshot.symbol}
                    </Text>
                    <Text
                      style={[styles.subtle, { color: colors.mutedForeground }]}
                    >
                      {signalLabel[snapshot.signalType]} ·{" "}
                      {dateLabel(snapshot.signalAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.value, { color: colors.foreground }]}>
                      {money(snapshot.signalPrice)}
                    </Text>
                    <Text
                      style={[
                        styles.subtle,
                        {
                          color:
                            move === null
                              ? colors.mutedForeground
                              : move >= 0
                                ? colors.up
                                : colors.down,
                        },
                      ]}
                    >
                      {move === null
                        ? "Hareket bekleniyor"
                        : `Şimdi ${percent(move)}`}
                    </Text>
                  </View>
                </View>
              );
            })
        )}
      </View>

      <View
        style={[
          styles.reportCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.reportTitle, { color: colors.foreground }]}>
          Sabah Dalga Takibi
        </Text>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>
          Akşam kapanışından sonraki ilk 30 dakikanın Demo gözlemi
        </Text>
        {account.morningWaveTests.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Favoriler içinde akşam kapanışı eksiye yakın aday yok.
          </Text>
        ) : (
          account.morningWaveTests.slice(-6).map((test) => (
            <View
              key={test.id}
              style={[styles.reportRow, { borderBottomColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.closedSymbol, { color: colors.foreground }]}
                >
                  {test.symbol}
                </Text>
                <Text
                  style={[styles.subtle, { color: colors.mutedForeground }]}
                >
                  Referans {money(test.referencePrice)} · Hedef{" "}
                  {money(test.targetPrice)}
                </Text>
                <Text
                  style={[styles.subtle, { color: colors.mutedForeground }]}
                >
                  Zarar kes {money(test.stopPrice)} · {test.note}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.value, { color: colors.foreground }]}>
                  {test.first30mResult === "hedefe_ulaştı"
                    ? "Hedef"
                    : test.first30mResult === "zarar_kes"
                      ? "Zarar kes"
                      : test.first30mResult === "hedef_yok"
                        ? "Hedef yok"
                        : "Bekliyor"}
                </Text>
                <Text
                  style={[
                    styles.subtle,
                    {
                      color:
                        (test.resultPercent ?? 0) >= 0
                          ? colors.up
                          : colors.down,
                    },
                  ]}
                >
                  {test.resultPercent === undefined
                    ? "Açılış bekleniyor"
                    : percent(test.resultPercent)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View
        style={[
          styles.summary,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Sanal özsermaye
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {money(values.equity)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Nakit
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {money(account.cash)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Toplam K/Z
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: values.total >= 0 ? colors.up : colors.down },
              ]}
            >
              {money(values.total)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Kapanan işlem
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {account.closedTrades.length}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Gerçekleşen K/Z
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: values.realized >= 0 ? colors.up : colors.down },
              ]}
            >
              {money(values.realized)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Kazanma oranı
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {values.winRate.toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Açık sanal işlemler ({account.positions.length})
      </Text>
      {loading ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Demo hesabı yükleniyor…
        </Text>
      ) : account.positions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Henüz sanal işlem yok. TREND taraması uygun sinyal bulduğunda otomatik
          kayıt oluşur.
        </Text>
      ) : (
        account.positions.map((position) => (
          <OpenPosition
            key={position.id}
            position={position}
            price={quotes[position.symbol]?.regularMarketPrice}
            onClose={() => handleClose(position)}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Kapanan işlemler ({account.closedTrades.length})
      </Text>
      <View
        style={[
          styles.closedCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {account.closedTrades.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Kapanmış sanal işlem bulunmuyor.
          </Text>
        ) : (
          account.closedTrades
            .slice(0, 20)
            .map((trade) => <ClosedTrade key={trade.id} position={trade} />)
        )}
      </View>

      <Pressable
        onPress={handleReset}
        style={({ pressed }) => [
          styles.resetButton,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.secondary : "transparent",
          },
        ]}
      >
        <Text style={[styles.resetText, { color: colors.down }]}>
          Demo hesabını sıfırla
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 27, fontFamily: "Inter_700Bold" },
  subtle: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  backButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  warning: { margin: 16, borderWidth: 1, borderRadius: 10, padding: 12 },
  warningText: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  reportCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  reportTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  periodTabs: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 6 },
  periodTab: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  reportRow: {
    minHeight: 58,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  summary: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryItem: { flex: 1 },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryValue: { marginTop: 4, fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionTitle: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 10,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  tradeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  tradeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  symbolLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  symbol: { fontSize: 20, fontFamily: "Inter_700Bold" },
  marketPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  pnl: { fontSize: 18, fontFamily: "Inter_700Bold" },
  grid: { marginTop: 12, gap: 7 },
  detailRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  closeButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  closeButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  closedCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  closedRow: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  closedSymbol: { fontSize: 15, fontFamily: "Inter_700Bold" },
  closedPnl: { fontSize: 14, fontFamily: "Inter_700Bold" },
  resetButton: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
  },
  resetText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
