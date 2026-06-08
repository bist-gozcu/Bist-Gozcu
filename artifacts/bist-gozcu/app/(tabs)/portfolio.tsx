import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { usePortfolio, PortfolioEntry } from "@/contexts/PortfolioContext";
import EmptyState from "@/components/EmptyState";

function AddModal({
  visible,
  onClose,
  editEntry,
}: {
  visible: boolean;
  onClose: () => void;
  editEntry?: PortfolioEntry | null;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry, updateEntry } = usePortfolio();
  const [symbol, setSymbol] = useState(editEntry?.symbol ?? "");
  const [qty, setQty] = useState(editEntry?.quantity?.toString() ?? "");
  const [avg, setAvg] = useState(editEntry?.avgPrice?.toString() ?? "");
  const [note, setNote] = useState(editEntry?.note ?? "");

  const handleSave = () => {
    const sym = symbol.toUpperCase().trim();
    const q = parseFloat(qty);
    const a = parseFloat(avg);
    if (!sym || isNaN(q) || isNaN(a)) {
      Alert.alert("Hata", "Sembol, adet ve ortalama fiyat zorunludur.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editEntry) updateEntry(editEntry.id, q, a, note);
    else addEntry(sym, q, a, note);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editEntry ? "Pozisyon Düzenle" : "Pozisyon Ekle"}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Hisse Sembolü</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                value={symbol}
                onChangeText={(t) => setSymbol(t.toUpperCase())}
                placeholder="THYAO"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                editable={!editEntry}
              />
            </View>
            <View style={styles.row2}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Adet</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Ort. Maliyet (₺)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  value={avg}
                  onChangeText={setAvg}
                  keyboardType="numeric"
                  placeholder="25.50"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Not (opsiyonel)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                value={note}
                onChangeText={setNote}
                placeholder="Not..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Kaydet</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function PortfolioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { quotes, loading, refresh } = useStocks();
  const { entries, removeEntry, totalCost, totalValue } = usePortfolio();
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<PortfolioEntry | null>(null);

  const prices: Record<string, number> = {};
  for (const [sym, q] of Object.entries(quotes)) {
    prices[sym] = q.regularMarketPrice;
  }

  const cost = totalCost(prices);
  const value = totalValue(prices);
  const totalPnl = value - cost;
  const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0;
  const isProfit = totalPnl >= 0;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const handleDelete = (entry: PortfolioEntry) => {
    Alert.alert("Pozisyonu Sil", `${entry.symbol} pozisyonunu silmek istiyor musunuz?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => removeEntry(entry.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Toplam Değer</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              ₺{value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Maliyet</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              ₺{cost.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Kar / Zarar</Text>
            <Text style={[styles.summaryValue, { color: isProfit ? colors.up : colors.down }]}>
              {isProfit ? "+" : ""}₺{totalPnl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.summaryPct, { color: isProfit ? colors.up : colors.down }]}>
              {isProfit ? "+" : ""}{totalPnlPct.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {entries.length === 0 ? (
        <EmptyState icon="briefcase" title="Portföy boş" subtitle="Sağ üstteki + butonuna basarak hisse ekleyin" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const price = prices[item.symbol] ?? item.avgPrice;
            const entryValue = price * item.quantity;
            const entryCost = item.avgPrice * item.quantity;
            const pnl = entryValue - entryCost;
            const pnlPct = entryCost > 0 ? (pnl / entryCost) * 100 : 0;
            const profit = pnl >= 0;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.entryRow,
                  { backgroundColor: pressed ? colors.accent : colors.card, borderBottomColor: colors.border },
                ]}
                onPress={() => router.push({ pathname: "/stock/[symbol]", params: { symbol: item.symbol } })}
                onLongPress={() => { setEditEntry(item); setShowModal(true); }}
              >
                <View style={styles.entryInfo}>
                  <Text style={[styles.entrySymbol, { color: colors.foreground }]}>{item.symbol}</Text>
                  <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
                    {item.quantity} adet • Ort: ₺{item.avgPrice.toFixed(2)}
                  </Text>
                  {item.note ? <Text style={[styles.entryNote, { color: colors.mutedForeground }]}>{item.note}</Text> : null}
                </View>
                <View style={styles.entryRight}>
                  <Text style={[styles.entryValue, { color: colors.foreground }]}>
                    ₺{entryValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.entryPnl, { color: profit ? colors.up : colors.down }]}>
                    {profit ? "+" : ""}{pnlPct.toFixed(2)}%
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={{ marginLeft: 10 }}>
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
        onPress={() => { setEditEntry(null); setShowModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditEntry(null); }}
        editEntry={editEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  summaryValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  summaryPct: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryInfo: { flex: 1 },
  entrySymbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  entrySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  entryNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 1 },
  entryRight: { alignItems: "flex-end", marginRight: 4 },
  entryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  entryPnl: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  field: { marginBottom: 12 },
  row2: { flexDirection: "row", gap: 12 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
