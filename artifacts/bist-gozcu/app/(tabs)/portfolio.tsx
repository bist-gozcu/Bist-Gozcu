import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { usePortfolio, PortfolioEntry } from "@/contexts/PortfolioContext";
import EmptyState from "@/components/EmptyState";
import { IconX, IconPlus, IconTrash, IconArrowUp, IconArrowDown } from "@/components/TabIcon";

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
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editEntry) updateEntry(editEntry.id, q, a, note);
    else addEntry(sym, q, a, note);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editEntry ? "Pozisyon Düzenle" : "Pozisyon Ekle"}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
                <IconX color={colors.mutedForeground} size={16} />
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
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: pressed ? colors.primary + "cc" : colors.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                {editEntry ? "Güncelle" : "Ekle"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PortfolioRow({ item, price, onDelete, onEdit, editMode, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  item: PortfolioEntry;
  price: number;
  onDelete: () => void;
  onEdit: () => void;
  editMode: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const entryValue = price * item.quantity;
  const entryCost = item.avgPrice * item.quantity;
  const pnl = entryValue - entryCost;
  const pnlPct = entryCost > 0 ? (pnl / entryCost) * 100 : 0;
  const profit = pnl >= 0;
  const pnlColor = profit ? colors.up : colors.down;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.entryRow,
        { backgroundColor: pressed ? colors.accent : colors.card, borderBottomColor: colors.border },
      ]}
      onPress={() => !editMode && router.push({ pathname: "/stock/[symbol]", params: { symbol: item.symbol } })}
      onLongPress={onEdit}
    >
      <View style={[styles.entryColorBar, { backgroundColor: pnlColor }]} />
      <View style={styles.entryInfo}>
        <View style={styles.entryTopRow}>
          <Text style={[styles.entrySymbol, { color: colors.foreground }]}>{item.symbol}</Text>
          <Text style={[styles.entryValue, { color: colors.foreground }]}>
            ₺{entryValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.entryBottomRow}>
          <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
            {item.quantity} adet · Ort: ₺{item.avgPrice.toFixed(2)}
          </Text>
          <View style={[styles.pnlPill, { backgroundColor: `${pnlColor}20` }]}>
            <Text style={[styles.entryPnl, { color: pnlColor }]}>
              {profit ? "+" : ""}{pnlPct.toFixed(2)}%
            </Text>
          </View>
        </View>
        {item.note ? (
          <Text style={[styles.entryNote, { color: colors.mutedForeground }]}>{item.note}</Text>
        ) : null}
      </View>
      {editMode ? (
        <View style={styles.reorderBtns}>
          <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6} style={styles.reorderBtn}>
            <IconArrowUp color={canMoveUp ? colors.mutedForeground : colors.border} size={16} />
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6} style={styles.reorderBtn}>
            <IconArrowDown color={canMoveDown ? colors.mutedForeground : colors.border} size={16} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onDelete} hitSlop={10} style={styles.deleteBtn}>
          <IconTrash color={colors.mutedForeground} size={16} />
        </Pressable>
      )}
    </Pressable>
  );
}

export default function PortfolioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh } = useStocks();
  const { entries, removeEntry, totalCost, totalValue, reorder } = usePortfolio();
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<PortfolioEntry | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleMove = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= entries.length) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    reorder(index, to);
  };

  const prices: Record<string, number> = {};
  for (const [sym, q] of Object.entries(quotes)) {
    prices[sym] = q.regularMarketPrice;
  }

  const cost = totalCost(prices);
  const value = totalValue(prices);
  const totalPnl = value - cost;
  const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0;
  const isProfit = totalPnl >= 0;
  const pnlColor = isProfit ? colors.up : colors.down;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const handleDelete = (entry: PortfolioEntry) => {
    Alert.alert("Pozisyonu Sil", `${entry.symbol} pozisyonunu silmek istiyor musunuz?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => removeEntry(entry.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      {/* Header */}
      <View style={[styles.pageHeader, styles.pageHeaderRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Portföy</Text>
        {entries.length > 0 && (
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            hitSlop={10}
            style={[styles.editBtn, { backgroundColor: editMode ? `${colors.primary}20` : colors.secondary }]}
          >
            <Text style={[styles.editBtnText, { color: editMode ? colors.primary : colors.mutedForeground }]}>
              {editMode ? "Tamam" : "Sırala"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Summary card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Toplam Değer</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              ₺{value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Maliyet</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              ₺{cost.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Kar / Zarar</Text>
            <Text style={[styles.summaryValue, { color: pnlColor }]}>
              {isProfit ? "+" : ""}₺{Math.abs(totalPnl).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={[styles.pnlBadge, { backgroundColor: `${pnlColor}20` }]}>
              <Text style={[styles.summaryPct, { color: pnlColor }]}>
                {isProfit ? "+" : ""}{totalPnlPct.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      {entries.length === 0 ? (
        <EmptyState icon="briefcase" title="Portföy boş" subtitle="Sağ alttaki + butonuna basarak hisse ekleyin" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item, index }) => (
            <PortfolioRow
              item={item}
              price={prices[item.symbol] ?? item.avgPrice}
              onDelete={() => handleDelete(item)}
              onEdit={() => { setEditEntry(item); setShowModal(true); }}
              editMode={editMode}
              onMoveUp={() => handleMove(index, -1)}
              onMoveDown={() => handleMove(index, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < entries.length - 1}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed ? colors.primary + "cc" : colors.primary, bottom: insets.bottom + 90 },
        ]}
        onPress={() => {
          setEditEntry(null);
          setShowModal(true);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <IconPlus color="#fff" size={24} />
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
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  pageHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reorderBtns: { flexDirection: "column", gap: 6, paddingLeft: 8 },
  reorderBtn: { padding: 2 },
  summaryCard: {
    margin: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 5, textAlign: "center" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  pnlBadge: { marginTop: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  summaryPct: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  entryColorBar: { width: 3, alignSelf: "stretch" },
  entryInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  entryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  entryBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entrySymbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  entrySub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  entryNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 3 },
  entryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pnlPill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  entryPnl: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 6 },
  fab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.75)" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingTop: 12,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  field: { marginBottom: 14 },
  row2: { flexDirection: "row", gap: 12 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: { borderRadius: 12, padding: 15, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
