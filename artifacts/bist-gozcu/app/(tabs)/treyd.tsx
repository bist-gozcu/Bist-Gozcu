import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import DecisionCard from "@/components/DecisionCard";
import { useMarketData } from "@/hooks/useMarketData";
import { getTop6Treyd, TreydSinyali } from "@/services/treydMotoru";
import { isPiyasaAcik } from "@/utils/seansKontrol";

export default function TreydScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isFetching, error, manuelYenile } = useMarketData("bist100");
  const [results, setResults] = useState<TreydSinyali[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const marketOpen = isPiyasaAcik();

  const scan = useCallback(() => {
    setResults(getTop6Treyd(data ?? []));
    setHasScanned(true);
  }, [data]);

  useEffect(() => {
    if (data && !hasScanned) scan();
  }, [data, hasScanned, scan]);

  const sessionLabel = useMemo(
    () => (marketOpen ? "Piyasa açık · canlı tarama mümkün" : "Piyasa kapalı · son veri gösteriliyor"),
    [marketOpen],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
          Platform.OS === "web" && { paddingTop: insets.top + 10 },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Treyd</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Pozitif momentum taraması
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void manuelYenile();
            setHasScanned(false);
          }}
          style={[styles.refreshButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.refreshText, { color: colors.primary }]}>Yenile</Text>
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
        <View
          style={[
            styles.sessionDot,
            { backgroundColor: marketOpen ? colors.up : colors.neutral },
          ]}
        />
        <Text style={[styles.sessionText, { color: colors.foreground }]}>{sessionLabel}</Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.sembol}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            <View style={styles.introCopy}>
              <Text style={[styles.introTitle, { color: colors.foreground }]}>
                Günün 6 adayı
              </Text>
              <Text style={[styles.introText, { color: colors.mutedForeground }]}>
                Değişim ve hacim medyanına göre pozitif trenddeki hisseler.
              </Text>
            </View>
            <Pressable
              onPress={scan}
              disabled={isFetching || !data}
              style={[
                styles.scanButton,
                { backgroundColor: isFetching || !data ? colors.border : colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.scanButtonText,
                  { color: isFetching || !data ? colors.mutedForeground : colors.primaryForeground },
                ]}
              >
                {isFetching ? "Taranıyor..." : "Taramayı Başlat"}
              </Text>
            </Pressable>
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
                etiket={item.etiket}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            {isLoading || isFetching ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {error ? "Veri alınamadı" : hasScanned ? "Pozitif aday bulunamadı" : "Tarama hazır"}
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {error
                    ? "Bağlantıyı kontrol edip yeniden deneyin."
                    : "İlk 6 sonucu görmek için taramayı başlatın."}
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
  listContent: { paddingHorizontal: 12 },
  intro: { paddingVertical: 12, gap: 12 },
  introCopy: { gap: 3 },
  introTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  introText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  scanButton: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  scanButtonText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
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
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});