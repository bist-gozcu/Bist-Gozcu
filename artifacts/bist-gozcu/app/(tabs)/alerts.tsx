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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAlerts, AlertType, PriceAlert } from "@/contexts/AlertContext";
import { useStocks } from "@/contexts/StockContext";
import EmptyState from "@/components/EmptyState";

const ALERT_LABELS: Record<AlertType, string> = {
  above: "Fiyat Üstünde",
  below: "Fiyat Altında",
  tp: "Kar Al",
  sl: "Zarar Kes",
};

const ALERT_ICONS: Record<AlertType, keyof typeof Feather.glyphMap> = {
  above: "arrow-up",
  below: "arrow-down",
  tp: "trending-up",
  sl: "trending-down",
};

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addAlert(sym, t, alertType, note);
    setSymbol(""); setTarget(""); setNote(""); setAlertType("above");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Alarm Ekle</Text>
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
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Alarm Türü</Text>
              <View style={styles.typeRow}>
                {alertTypes.map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: alertType === t ? colors.primary : colors.input,
                        borderColor: alertType === t ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setAlertType(t)}
                  >
                    <Feather
                      name={ALERT_ICONS[t]}
                      size={12}
                      color={alertType === t ? "#fff" : colors.mutedForeground}
                    />
                    <Text style={[styles.typeBtnText, { color: alertType === t ? "#fff" : colors.mutedForeground }]}>
                      {ALERT_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
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

            <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
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
  const progress = price != null && alert.targetPrice > 0
    ? Math.min((price / alert.targetPrice) * 100, 100)
    : null;

  const alertColor =
    alert.alertType === "tp" ? colors.up :
    alert.alertType === "sl" ? colors.down :
    alert.alertType === "above" ? colors.up :
    colors.down;

  const handleDelete = () => {
    Alert.alert("Alarmı Sil", `${alert.symbol} alarmını silmek istiyor musunuz?`, [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => { removeAlert(alert.id); dismissTriggered(alert.id); } },
    ]);
  };

  return (
    <View style={[styles.alertCard, { backgroundColor: colors.card, borderColor: alert.triggered ? alertColor : colors.border }]}>
      <View style={styles.alertLeft}>
        <View style={styles.alertSymbolRow}>
          <Text style={[styles.alertSymbol, { color: colors.foreground }]}>{alert.symbol}</Text>
          {alert.triggered && (
            <View style={[styles.triggeredBadge, { backgroundColor: alertColor }]}>
              <Text style={styles.triggeredText}>TETIKLENDI</Text>
            </View>
          )}
        </View>
        <Text style={[styles.alertDesc, { color: alertColor }]}>
          <Feather name={ALERT_ICONS[alert.alertType]} size={11} color={alertColor} />
          {" "}{ALERT_LABELS[alert.alertType]}: ₺{alert.targetPrice.toFixed(2)}
        </Text>
        {price != null && (
          <Text style={[styles.alertCurrent, { color: colors.mutedForeground }]}>
            Güncel: ₺{price.toFixed(2)}
          </Text>
        )}
        {alert.note ? (
          <Text style={[styles.alertNote, { color: colors.mutedForeground }]}>{alert.note}</Text>
        ) : null}
      </View>
      <Pressable onPress={handleDelete} hitSlop={8}>
        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
      </Pressable>
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
      {triggeredAlerts.length > 0 && (
        <View style={[styles.triggerBanner, { backgroundColor: `${colors.down}22`, borderColor: `${colors.down}55` }]}>
          <Feather name="alert-triangle" size={16} color={colors.down} />
          <Text style={[styles.triggerText, { color: colors.down }]}>
            {triggeredAlerts.length} alarm tetiklendi!
          </Text>
          <Pressable onPress={clearTriggered} hitSlop={8}>
            <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>Kapat</Text>
          </Pressable>
        </View>
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
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: insets.bottom + 80 }}
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
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
        onPress={() => { setShowModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddAlertModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  triggerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  triggerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dismissText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  alertLeft: { flex: 1 },
  alertSymbolRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  alertSymbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  triggeredBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  triggeredText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  alertDesc: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  alertCurrent: { fontSize: 12, fontFamily: "Inter_400Regular" },
  alertNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2 },
  sectionHeader: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8, marginTop: 4 },
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
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  typeBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  saveBtn: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
