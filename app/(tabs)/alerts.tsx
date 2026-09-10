import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAlerts, AlertType, PriceAlert } from "@/contexts/AlertContext";
import { useStocks } from "@/contexts/StockContext";
import EmptyState from "@/components/EmptyState";
import {
  IconX,
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconNotifications,
} from "@/components/TabIcon";

const ALERT_LABELS: Record<AlertType, string> = {
  above: "Fiyat Üstünde",
  below: "Fiyat Altında",
  tp: "Kar Al",
  sl: "Zarar Kes",
};

type AlertIconKey = AlertType;

function AlertIcon({ type, color, size = 14 }: { type: AlertIconKey; color: string; size?: number }) {
  if (type === "above") return <IconArrowUp color={color} size={size} />;
  if (type === "below") return <IconArrowDown color={color} size={size} />;
  if (type === "tp") return <IconTrendingUp color={color} size={size} />;
  return <IconTrendingDown color={color} size={size} />;
}

function AddAlertModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addAlert } = useAlerts();
  const [symbol, setSymbol] = useState("");
  const [target, setTarget] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("above");
  const [note, setNote] = useState("");

  const alertTypes: AlertType[] = ["above", "below", "tp", "sl"];

  const handleSave = () => {
    const sym = symbol.toUpperCase().trim();
    const t = parseFloat(target);
    if (!sym || isNaN(t)) {
      Alert.alert("Hata", "Sembol ve hedef fiyat zorunludur.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addAlert(sym, t, alertType, note);
    setSymbol(""); setTarget(""); setNote(""); setAlertType("above");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Alarm Ekle</Text>
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
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Alarm Türü</Text>
              <View style={styles.typeRow}>
                {alertTypes.map((t) => {
                  const active = alertType === t;
                  const typeColor = (t === "tp" || t === "above") ? colors.up : colors.down;
                  return (
                    <Pressable
                      key={t}
                      style={[
                        styles.typeBtn,
                        {
                          backgroundColor: active ? `${typeColor}20` : colors.input,
                          borderColor: active ? typeColor : colors.border,
                        },
                      ]}
                      onPress={() => setAlertType(t)}
                    >
                      <AlertIcon type={t} color={active ? typeColor : colors.mutedForeground} size={13} />
                      <Text style={[styles.typeBtnText, { color: active ? typeColor : colors.mutedForeground }]}>
                        {ALERT_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Hedef Fiyat (₺)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                value={target}
                onChangeText={setTarget}
                keyboardType="numeric"
                placeholder="150.00"
                placeholderTextColor={colors.mutedForeground}
              />
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
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Alarm Ekle</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function AlertCard({ alert }: { alert: PriceAlert }) {
  const colors = useColors();
  const { removeAlert, dismissTriggered } = useAlerts();
  const { quotes } = useStocks();
  const price = quotes[alert.symbol]?.regularMarketPrice;

  const alertColor =
    alert.alertType === "tp" || alert.alertType === "above" ? colors.up : colors.down;

  const progress = price != null && alert.targetPrice > 0
    ? Math.min(Math.max((price / alert.targetPrice) * 100, 0), 100)
    : null;

  const diff = price != null ? ((alert.targetPrice - price) / price * 100) : null;

  const handleDelete = () => {
    Alert.alert("Alarmı Sil", `${alert.symbol} alarmını silmek istiyor musunuz?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => { removeAlert(alert.id); dismissTriggered(alert.id); } },
    ]);
  };

  return (
    <View style={[
      styles.alertCard,
      { backgroundColor: colors.card, borderColor: alert.triggered ? alertColor : colors.border }
    ]}>
      {/* Left accent bar */}
      <View style={[styles.alertAccent, { backgroundColor: alertColor }]} />

      <View style={styles.alertBody}>
        <View style={styles.alertTopRow}>
          <View style={styles.alertSymbolRow}>
            <Text style={[styles.alertSymbol, { color: colors.foreground }]}>{alert.symbol}</Text>
            {alert.triggered && (
              <View style={[styles.triggeredBadge, { backgroundColor: alertColor }]}>
                <Text style={styles.triggeredText}>TETİKLENDİ</Text>
              </View>
            )}
          </View>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <IconTrash color={colors.mutedForeground} size={15} />
          </Pressable>
        </View>

        <View style={styles.alertDescRow}>
          <AlertIcon type={alert.alertType} color={alertColor} size={13} />
          <Text style={[styles.alertDesc, { color: alertColor }]}>
            {ALERT_LABELS[alert.alertType]}: ₺{alert.targetPrice.toFixed(2)}
          </Text>
        </View>

        {price != null && (
          <View style={styles.alertPriceRow}>
            <Text style={[styles.alertCurrent, { color: colors.mutedForeground }]}>
              Güncel: ₺{price.toFixed(2)}
            </Text>
            {diff != null && !alert.triggered && (
              <Text style={[styles.alertDiff, { color: Math.abs(diff) < 2 ? colors.neutral : colors.mutedForeground }]}>
                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
              </Text>
            )}
          </View>
        )}

        {progress != null && !alert.triggered && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: alertColor }]} />
          </View>
        )}

        {alert.note ? (
          <Text style={[styles.alertNote, { color: colors.mutedForeground }]}>{alert.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, triggeredAlerts, clearTriggered } = useAlerts();
  const [showModal, setShowModal] = useState(false);
  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      {/* Header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Alarmlar</Text>
        {alerts.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{alerts.length}</Text>
          </View>
        )}
      </View>

      {/* Triggered banner */}
      {triggeredAlerts.length > 0 && (
        <Pressable
          style={[styles.triggerBanner, { backgroundColor: `${colors.neutral}18`, borderColor: `${colors.neutral}44` }]}
          onPress={clearTriggered}
        >
          <IconAlertTriangle color={colors.neutral} size={16} />
          <Text style={[styles.triggerText, { color: colors.neutral }]}>
            {triggeredAlerts.length} alarm tetiklendi!
          </Text>
          <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>Kapat ›</Text>
        </Pressable>
      )}

      {alerts.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Alarm yok"
          subtitle="Hisse fiyatı hedef seviyeye ulaştığında bildirim alın"
        />
      ) : (
        <FlatList
          data={[...triggered, ...active]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            triggered.length > 0 && active.length > 0 ? (
              <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
                Aktif Alarmlar
              </Text>
            ) : null
          }
        />
      )}

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed ? colors.primary + "cc" : colors.primary, bottom: insets.bottom + 90 },
        ]}
        onPress={() => {
          setShowModal(true);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <IconPlus color="#fff" size={24} />
      </Pressable>

      <AddAlertModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  triggerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  triggerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dismissText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  alertCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  alertAccent: { width: 4 },
  alertBody: { flex: 1, padding: 12 },
  alertTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  alertSymbolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertSymbol: { fontSize: 16, fontFamily: "Inter_700Bold" },
  triggeredBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  triggeredText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  alertDescRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  alertDesc: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertPriceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  alertCurrent: { fontSize: 12, fontFamily: "Inter_400Regular" },
  alertDiff: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", borderRadius: 2 },
  alertNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 4 },
  sectionHeader: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },
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
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  typeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  saveBtn: { borderRadius: 12, padding: 15, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
