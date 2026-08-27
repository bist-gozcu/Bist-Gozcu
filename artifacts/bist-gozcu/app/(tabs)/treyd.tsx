import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import DecisionCard from "@/components/DecisionCard";
import { useMarketData } from "@/hooks/useMarketData";
import {
  getTop6TreydWithConfirmation,
  TreydSinyali,
} from "@/services/treydMotoru";
import { isPiyasaAcik } from "@/utils/seansKontrol";
import { fireRadarNotifications } from "@/contexts/AlertContext";

export default function TreydScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isFetching, error, manuelYenile } =
    useMarketData("bist100");
  const [results, setResults] = useState<TreydSinyali[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const marketOpen = isPiyasaAcik();
  const dailyResults = useMemo(
    () => results.filter((item) => item.radarDurumu === "gunluk_teyitli"),
    [results],
  );
  const intradayResults = useMemo(
    () => results.filter((item) => item.radarDurumu === "gun_ici_izleme"),
    [results],
  );
  const sections = useMemo(() => {
    const nextSections: Array<{
      key: string;
      title: string;
      data: TreydSinyali[];
    }> = [];
    if (dailyResults.length > 0)
      nextSections.push({
        key: "daily",
        title: "Günlük Kapanış Teyitli",
        data: dailyResults,
      });
    if (intradayResults.length > 0)
      nextSections.push({
        key: "intraday",
        title: "Gün İçi İzleme",
        data: intradayResults,
      });
    return nextSections;
  }, [dailyResults, intradayResults]);

  const scan = useCallback(async () => {
    if (!data || isScanning || isRefreshing) return;

    setIsScanning(true);
    try {
      const confirmedResults = await getTop6TreydWithConfirmation(data);
      setResults(confirmedResults);
      setHasScanned(true);
      void fireRadarNotifications(
        confirmedResults.map((item) => ({
          symbol: item.sembol,
          price: item.fiyat,
          changePercent: item.degisimYuzde,
          teyitSayisi: item.teyitSayisi,
          teyitler: item.teyitler,
          radarDurumu: item.radarDurumu,
          veriKalitesi: item.veriKalitesi,
        })),
      );
    } finally {
      setIsScanning(false);
    }
  }, [data, isScanning, isRefreshing]);

  const refreshAndScan = useCallback(async () => {
    if (isRefreshing || isScanning) return;
    setHasScanned(false);
    setIsRefreshing(true);
    try {
      await manuelYenile();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isScanning, manuelYenile]);

  useEffect(() => {
    if (data && !hasScanned && !isScanning && !isRefreshing) void scan();
  }, [data, hasScanned, isScanning, isRefreshing, scan]);

  const sessionLabel = useMemo(
    () =>
      marketOpen
        ? "Piyasa açık · canlı tarama mümkün"
        : "Piyasa kapalı · son veri gösteriliyor",
    [marketOpen],
  );
  const scanBusy = isFetching || isScanning || isRefreshing;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            TREND
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            BIST 30/50 içinde çoklu teyitli trend taraması
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void refreshAndScan();
          }}
          disabled={scanBusy}
          style={[
            styles.refreshButton,
            { backgroundColor: scanBusy ? colors.border : colors.secondary },
          ]}
        >
          <Text
            style={[
              styles.refreshText,
              { color: scanBusy ? colors.mutedForeground : colors.primary },
            ]}
          >
            Yenile
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.sessionBanner,
          {
            backgroundColor: marketOpen
              ? `${colors.up}18`
              : `${colors.neutral}18`,
            borderColor: marketOpen ? `${colors.up}44` : `${colors.neutral}44`,
          },
        ]}
      >
        <View
          style={[
            styles.sessionDot,
            { backgroundColor: marketOpen ? colors.up : colors.neutral },
          ]}
        />
        <Text style={[styles.sessionText, { color: colors.foreground }]}>
          {sessionLabel}
        </Text>
      </View>

      <View
        style={[
          styles.notice,
          {
            backgroundColor: `${colors.neutral}12`,
            borderColor: `${colors.neutral}30`,
          },
        ]}
      >
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
          Günlük Kapanış Teyitli bölümü tamamlanmış günlük mumlara dayanır. Gün
          İçi İzleme adayları kapanışta bozulabilir; veri eski veya belirsizse
          yeni aday ve bildirim üretilmez.
        </Text>
      </View>

      <SectionList<TreydSinyali>
        sections={sections}
        keyExtractor={(item) => `${item.sembol}-${item.radarDurumu}`}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={scanBusy}
        onRefresh={() => void refreshAndScan()}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={[styles.introTitle, { color: colors.foreground }]}>
              Trend Radarı
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {section.title}
            </Text>
            <Text
              style={[styles.sectionCount, { color: colors.mutedForeground }]}
            >
              {section.data.length} aday
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={styles.resultRow}>
            <View style={[styles.rank, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.rankText, { color: colors.primary }]}>
                #{index + 1}
              </Text>
            </View>
            <View style={styles.resultCard}>
              <DecisionCard
                sembol={item.sembol}
                skor={item.skor}
                guncelFiyat={item.fiyat}
                gunlukDegisim={item.degisimYuzde}
                onPress={() =>
                  router.push({
                    pathname: "/stock/[symbol]",
                    params: { symbol: item.sembol },
                  })
                }
                etiket={item.etiket}
                teyitSayisi={item.teyitSayisi}
                toplamTeyit={item.toplamTeyit}
                trendTeyitli={item.trendTeyitli}
                gunlukTrend={item.gunlukTrend}
                direnc={item.direnc}
                direncKirildi={item.direncKirildi}
                hacimTeyitli={item.hacimTeyitli}
                rsiValue={item.rsiValue}
                rsiUygun={item.rsiUygun}
                yuksekDip={item.yuksekDip}
                yuksekTepe={item.yuksekTepe}
                yapiTeyitli={item.yapiTeyitli}
                teyitler={item.teyitler}
                radarDurumu={
                  section.key === "daily" ? "gunluk_teyitli" : "gun_ici_izleme"
                }
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          dailyResults.length > 0 ? (
            <View
              style={[
                styles.dailyTradeSection,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.dailyTradeTitle, { color: colors.foreground }]}
              >
                Günlük Trade Adayları
              </Text>
              <View style={styles.dailyTradeNames}>
                {dailyResults.map((item) => (
                  <Pressable
                    key={`daily-${item.sembol}`}
                    onPress={() =>
                      router.push({
                        pathname: "/stock/[symbol]",
                        params: { symbol: item.sembol },
                      })
                    }
                    style={({ pressed }) => [
                      styles.dailyTradeName,
                      { backgroundColor: colors.secondary },
                      pressed && styles.dailyTradeNamePressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dailyTradeNameText,
                        { color: colors.primary },
                      ]}
                    >
                      {item.sembol}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            {isLoading || isFetching || isScanning ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {error
                    ? "Veri alınamadı"
                    : hasScanned
                      ? "Radar sonucu bulunamadı"
                      : "Radar taraması hazırlanıyor"}
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  {error
                    ? "Bağlantıyı kontrol edip aşağı çekerek yeniden deneyin."
                    : "Yeterli likidite ve en az 5/6 teyit alan adaylar burada görünür."}
                </Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  refreshText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    marginBottom: 4,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  sessionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  notice: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  noticeText: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 12 },
  intro: { paddingVertical: 12 },
  introTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionCount: { fontSize: 11, fontFamily: "Inter_500Medium" },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  rankText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  resultCard: { flex: 1 },
  empty: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 20,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  dailyTradeSection: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dailyTradeTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  dailyTradeNames: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dailyTradeName: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dailyTradeNamePressed: { opacity: 0.65 },
  dailyTradeNameText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
