import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

export default function TreydScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isFetching, error, manuelYenile } = useMarketData("bist100");
  const [results, setResults] = useState<TreydSinyali[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const marketOpen = isPiyasaAcik();

  const scan = useCallback(async () => {
    if (!data || isScanning || isRefreshing) return;

    setIsScanning(true);
    try {
      const confirmedResults = await getTop6TreydWithConfirmation(data);
      setResults(confirmedResults);
      setHasScanned(true);
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
    () => (marketOpen ? "Piyasa açık · canlı tarama mümkün" : "Piyasa kapalı · son veri gösteriliyor"),
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
          <Text style={[styles.title, { color: colors.foreground }]}>Treyd</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Çoklu teyitli momentum taraması</Text>
        </View>
        <Pressable
          onPress={() => {
            void refreshAndScan();
          }}
          disabled={scanBusy}
          style={[styles.refreshButton, { backgroundColor: scanBusy ? colors.border : colors.secondary }]}
        >
          <Text style={[styles.refreshText, { color: scanBusy ? colors.mutedForeground : colors.primary }]}>Yenile</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.sessionBanner,
          {
            backgroundColor: marketOpen ? `${colors.up}18` : `${colors.neutral}18`,
            borderColor: marketOpen ? `${colors.up}44` : `${colors.neutral}44`,
          },
        ]}
      >
        <View style={[styles.sessionDot, { backgroundColor: marketOpen ? colors.up : colors.neutral }]} />
        <Text style={[styles.sessionText, { color: colors.foreground }]}>{sessionLabel}</Text>
      </View>

      <View style={[styles.notice, { backgroundColor: `${colors.neutral}12`, borderColor: `${colors.neutral}30` }]}>
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>Günlük yükseliş yalnızca ön elemedir. Momentum etiketi için en az 5/6, güçlü alım için 6/6 teyit gerekir; bu ekran kesin sonuç veya yatırım tavsiyesi değildir.</Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.sembol}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshing={scanBusy}
        onRefresh={() => void refreshAndScan()}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={[styles.introTitle, { color: colors.foreground }]}>Radar’a Girenler</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.resultRow}>
            <View style={[styles.rank, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.rankText, { color: colors.primary }]}>#{index + 1}</Text>
            </View>
            <View style={styles.resultCard}>
              <DecisionCard
                sembol={item.sembol}
                skor={item.skor}
                guncelFiyat={item.fiyat}
                gunlukDegisim={item.degisimYuzde}
                onPress={() => router.push({ pathname: "/stock/[symbol]", params: { symbol: item.sembol } })}
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
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            {isLoading || isFetching || isScanning ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{error ? "Veri alınamadı" : hasScanned ? "Radar sonucu bulunamadı" : "Radar taraması hazırlanıyor"}</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error ? "Bağlantıyı kontrol edip aşağı çekerek yeniden deneyin." : "Veriler hazır olduğunda teyitli adaylar burada görünür."}</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  refreshText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sessionBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 4, padding: 11, borderRadius: 10, borderWidth: 1 },
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  sessionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  notice: { marginHorizontal: 12, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  noticeText: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 12 },
  intro: { paddingVertical: 12 },
  introTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 14 },
  rankText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  resultCard: { flex: 1 },
  empty: { minHeight: 150, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 7, padding: 20 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
