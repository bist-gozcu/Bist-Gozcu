import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { fetchMacroQuotes, fetchMarketNews, MarketNews, QuoteData } from "@/utils/yahooFinance";
import { ALL_BIST_STOCKS } from "@/constants/bistStocks";
import StockRow from "@/components/StockRow";
import {
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconTrash,
  IconPlus,
  IconX,
} from "@/components/TabIcon";

type SortKey = "name" | "price" | "change" | "volume";
type SortDir = "asc" | "desc";

type MacroAsset = { symbol: string; label: string; unit: string; decimals: number };

const MACRO_ASSETS: MacroAsset[] = [
  { symbol: "USDTRY=X", label: "Dolar/TL", unit: "₺", decimals: 4 },
  { symbol: "EURTRY=X", label: "Euro/TL", unit: "₺", decimals: 4 },
  { symbol: "GC=F", label: "Altın / ons", unit: "$", decimals: 2 },
  { symbol: "XU030.IS", label: "BIST 30", unit: "", decimals: 2 },
  { symbol: "XU050.IS", label: "BIST 50", unit: "", decimals: 2 },
  { symbol: "XU100.IS", label: "BIST 100", unit: "", decimals: 2 },
];

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh, lastUpdated, isMarketOpen } = useStocks();
  const { watchlist, addToWatchlist, removeFromWatchlist, reorder } = useWatchlist();
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editMode, setEditMode] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [macroQuotes, setMacroQuotes] = useState<Record<string, QuoteData>>({});
  const [marketNews, setMarketNews] = useState<MarketNews[]>([]);

  const loadMacro = useCallback(async () => {
    const [macro, news] = await Promise.all([
      fetchMacroQuotes(MACRO_ASSETS.map((asset) => asset.symbol)),
      fetchMarketNews("Borsa Istanbul", 6),
    ]);
    const next: Record<string, QuoteData> = {};
    macro.forEach((quote) => { next[quote.symbol] = quote; });
    setMacroQuotes(next);
    setMarketNews(news);
  }, []);

  useEffect(() => {
    void loadMacro();
    const timer = setInterval(() => void loadMacro(), 120000);
    return () => clearInterval(timer);
  }, [loadMacro]);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([refresh(), loadMacro()]);
    } finally {
      setManualRefreshing(false);
    }
  }, [loadMacro, refresh]);

  const handleSort = (key: SortKey) => {
    if (editMode) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const listData = editMode
    ? watchlist
    : [...watchlist].sort((a, b) => {
        const qa = quotes[a];
        const qb = quotes[b];
        let va = 0, vb = 0;
        if (sortKey === "name") {
          const c = a.localeCompare(b);
          return sortDir === "asc" ? c : -c;
        }
        if (sortKey === "price") { va = qa?.regularMarketPrice ?? 0; vb = qb?.regularMarketPrice ?? 0; }
        if (sortKey === "change") { va = qa?.regularMarketChangePercent ?? 0; vb = qb?.regularMarketChangePercent ?? 0; }
        if (sortKey === "volume") { va = qa?.regularMarketVolume ?? 0; vb = qb?.regularMarketVolume ?? 0; }
        return sortDir === "asc" ? va - vb : vb - va;
      });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const upCount = watchlist.filter((s) => (quotes[s]?.regularMarketChangePercent ?? 0) > 0).length;
  const downCount = watchlist.filter((s) => (quotes[s]?.regularMarketChangePercent ?? 0) < 0).length;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const formatMacroValue = (asset: MacroAsset, quote?: QuoteData) => {
    if (!quote?.regularMarketPrice) return "—";
    return `${asset.unit}${quote.regularMarketPrice.toLocaleString("tr-TR", { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals })}`;
  };

  const reportChanges = watchlist
    .map((symbol) => quotes[symbol]?.regularMarketChangePercent)
    .filter((value): value is number => Number.isFinite(value));
  const reportAverage = reportChanges.length
    ? reportChanges.reduce((sum, value) => sum + value, 0) / reportChanges.length
    : null;
  const reportText = reportAverage == null
    ? "Kapanış/sabah notu için yeterli veri bekleniyor."
    : reportAverage > 0.5
      ? `İzleme listesindeki hisselerde ortalama değişim +${reportAverage.toFixed(2)}%. Açılış sonrası yükselişin hacim ve endeks desteğiyle devam edip etmediği teyit edilmelidir; tek günlük yükseliş tek başına alım sinyali değildir.`
      : reportAverage < -0.5
        ? `İzleme listesindeki hisselerde ortalama değişim ${reportAverage.toFixed(2)}%. Risk iştahı zayıf görünüyor; destek seviyeleri ve BIST 30/100 yönü görülmeden agresif işlemden kaçınmak daha temkinlidir.`
        : `İzleme listesindeki hisselerde ortalama değişim ${reportAverage >= 0 ? "+" : ""}${reportAverage.toFixed(2)}%. Piyasa yatay; seçici işlem için hacim, trend ve direnç teyidi beklenmelidir.`;

  const handleMove = useCallback((symbol: string, direction: -1 | 1) => {
    const from = watchlist.indexOf(symbol);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= watchlist.length) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    reorder(from, to);
  }, [watchlist, reorder]);

  const handleRemove = useCallback((symbol: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromWatchlist(symbol);
  }, [removeFromWatchlist]);

  const availableStocks = ALL_BIST_STOCKS.filter((stock) => {
    if (watchlist.includes(stock.symbol)) return false;
    const q = addQuery.trim().toUpperCase();
    return !q || stock.symbol.includes(q) || stock.name.toUpperCase().includes(q);
  }).slice(0, 30);

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <Pressable onPress={() => handleSort(k)} style={styles.sortBtn}>
      <Text style={[styles.sortLabel, { color: sortKey === k ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
      {sortKey === k && (
        sortDir === "desc"
          ? <IconChevronDown color={colors.primary} size={11} />
          : <IconChevronUp color={colors.primary} size={11} />
      )}
    </Pressable>
  );

  const renderRightActions = (symbol: string) => (
    <Pressable
      style={[styles.swipeDelete, { backgroundColor: colors.down }]}
      onPress={() => handleRemove(symbol)}
    >
      <IconTrash color="#fff" size={18} />
      <Text style={styles.swipeDeleteText}>Sil</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>BIST Hisseleri</Text>
          <View style={styles.headerSub}>
            <View style={[styles.statusDot, { backgroundColor: isMarketOpen ? colors.up : colors.mutedForeground }]} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              {isMarketOpen ? "Borsa Açık" : "Borsa Kapalı"}
            </Text>
            {lastUpdated && (
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                {" • "}{formatTime(lastUpdated)}
              </Text>
            )}
            <Text style={[styles.headerHint, { color: colors.mutedForeground }]}>Yıldız: Favoriler · Düzenle: Piyasa listesi</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {Object.keys(quotes).length > 0 && !editMode && (
            <View style={styles.marketSummary}>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryNum, { color: colors.up }]}>{upCount}</Text>
                <Text style={[styles.summaryArrow, { color: colors.up }]}>▲</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryNum, { color: colors.down }]}>{downCount}</Text>
                <Text style={[styles.summaryArrow, { color: colors.down }]}>▼</Text>
              </View>
            </View>
          )}
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            hitSlop={10}
            style={[styles.editBtn, { backgroundColor: editMode ? `${colors.primary}20` : colors.secondary }]}
          >
            <Text style={[styles.editBtnText, { color: editMode ? colors.primary : colors.mutedForeground }]}>
              {editMode ? "Tamam" : "Düzenle"}
            </Text>
          </Pressable>
          {!editMode && (
            <Pressable onPress={handleManualRefresh} hitSlop={12} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
              <IconRefresh color={colors.mutedForeground} size={14} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.macroSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Piyasa Özeti</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.macroRow}>
          {MACRO_ASSETS.map((asset) => {
            const key = asset.symbol.replace(/\\.IS$/i, "").toUpperCase();
            const quote = macroQuotes[key] ?? macroQuotes[asset.symbol];
            const change = quote?.regularMarketChangePercent;
            const tone = change == null ? colors.mutedForeground : change >= 0 ? colors.up : colors.down;
            return (
              <View key={asset.symbol} style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{asset.label}</Text>
                <Text style={[styles.macroValue, { color: colors.foreground }]}>{formatMacroValue(asset, quote)}</Text>
                <Text style={[styles.macroChange, { color: tone }]}>{change == null ? "Veri bekleniyor" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.reportTitle, { color: colors.foreground }]}>{isMarketOpen ? "Gün içi piyasa notu" : "Kapanış / sabah notu"}</Text>
          <Text style={[styles.reportText, { color: colors.mutedForeground }]}>{reportText}</Text>
        </View>
        {marketNews.length > 0 && (
          <View style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reportTitle, { color: colors.foreground }]}>Piyasa haberleri</Text>
            {marketNews.slice(0, 4).map((item, index) => (
              <Pressable key={`${item.title}-${index}`} disabled={!item.link} onPress={() => item.link && Linking.openURL(item.link)} style={styles.newsRow}>
                <View style={[styles.newsDot, { backgroundColor: colors.primary }]} />
                <View style={styles.newsCopy}>
                  <Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.newsMeta, { color: colors.mutedForeground }]}>{item.publisher || "Kaynak belirtilmedi"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Sort row */}
      {!editMode && (
        <View style={[styles.sortRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <SortBtn label="Sembol" k="name" />
          <View style={styles.spacer} />
          <SortBtn label="Hacim" k="volume" />
          <SortBtn label="Fiyat" k="price" />
          <SortBtn label="Değişim" k="change" />
          <View style={{ width: 28 }} />
        </View>
      )}
      {editMode && (
        <View style={[styles.editHint, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.editHintText, { color: colors.mutedForeground }]}>
            Sıralamak için ok tuşlarını kullanın, silmek için sola kaydırın
          </Text>
          <Pressable
            onPress={() => { setAddQuery(""); setShowAddModal(true); }}
            style={[styles.addStockBtn, { backgroundColor: colors.primary }]}
          >
            <IconPlus color={colors.primaryForeground} size={14} />
            <Text style={[styles.addStockBtnText, { color: colors.primaryForeground }]}>Hisse ekle</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={styles.modalKeyboard}>
            <View style={[styles.addModal, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 14 }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Piyasa listesine hisse ekle</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{watchlist.length} hisse listede</Text>
                </View>
                <Pressable onPress={() => setShowAddModal(false)} hitSlop={10} style={[styles.modalCloseBtn, { backgroundColor: colors.secondary }]}>
                  <IconX color={colors.mutedForeground} size={15} />
                </Pressable>
              </View>
              <TextInput
                autoFocus
                value={addQuery}
                onChangeText={setAddQuery}
                placeholder="Sembol veya şirket ara"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.addInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                returnKeyType="search"
              />
              <FlatList
                data={availableStocks}
                keyExtractor={(item) => item.symbol}
                keyboardShouldPersistTaps="handled"
                style={styles.addResults}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { addToWatchlist(item.symbol); setShowAddModal(false); }}
                    style={({ pressed }) => [styles.addResultRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.65 }]}
                  >
                    <View style={styles.addResultCopy}>
                      <Text style={[styles.addResultSymbol, { color: colors.foreground }]}>{item.symbol}</Text>
                      <Text style={[styles.addResultName, { color: colors.mutedForeground }]} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <IconPlus color={colors.primary} size={18} />
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={[styles.addEmpty, { color: colors.mutedForeground }]}>Eklenecek hisse bulunamadı.</Text>}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {loading && Object.keys(quotes).length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Veriler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item}
          renderItem={({ item, index }) =>
            editMode ? (
              <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
                <View style={[styles.rowWrap, { backgroundColor: colors.card }]}>
                  <View style={styles.rowFlex}>
                    <StockRow symbol={item} quote={quotes[item]} showFavoriteBtn={false} />
                  </View>
                  <View style={styles.reorderBtns}>
                    <Pressable
                      onPress={() => handleMove(item, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                      style={styles.reorderBtn}
                    >
                      <IconArrowUp color={index === 0 ? colors.border : colors.mutedForeground} size={16} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMove(item, 1)}
                      disabled={index === listData.length - 1}
                      hitSlop={6}
                      style={styles.reorderBtn}
                    >
                      <IconArrowDown color={index === listData.length - 1 ? colors.border : colors.mutedForeground} size={16} />
                    </Pressable>
                  </View>
                </View>
              </Swipeable>
            ) : (
              <StockRow symbol={item} quote={quotes[item]} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={manualRefreshing}
              onRefresh={handleManualRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  macroSection: { paddingTop: 10, paddingBottom: 4 },
  sectionTitle: { paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 8 },
  macroRow: { paddingHorizontal: 12, gap: 8 },
  macroCard: { width: 132, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  macroLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  macroValue: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 5 },
  macroChange: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  reportCard: { marginHorizontal: 12, marginTop: 10, padding: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  reportTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  reportText: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  newsCard: { marginHorizontal: 12, marginTop: 8, padding: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  newsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(127,127,127,0.18)" },
  newsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  newsCopy: { flex: 1 },
  newsTitle: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_600SemiBold" },
  newsMeta: { fontSize: 10, marginTop: 3, fontFamily: "Inter_400Regular" },
  headerSub: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketSummary: { flexDirection: "row", gap: 8 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryArrow: { fontSize: 9 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4 },
  sortLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  spacer: { flex: 1 },
  editHint: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  addStockBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  addStockBtnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  modalKeyboard: { width: "100%", justifyContent: "flex-end" },
  addModal: { maxHeight: "86%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  addInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  addResults: { maxHeight: 380 },
  addResultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  addResultCopy: { flex: 1, marginRight: 10 },
  addResultSymbol: { fontSize: 14, fontFamily: "Inter_700Bold" },
  addResultName: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  addEmpty: { textAlign: "center", paddingVertical: 24, fontSize: 13, fontFamily: "Inter_400Regular" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowWrap: { flexDirection: "row", alignItems: "center" },
  rowFlex: { flex: 1 },
  reorderBtns: { flexDirection: "column", paddingHorizontal: 10, gap: 6 },
  reorderBtn: { padding: 2 },
  swipeDelete: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
