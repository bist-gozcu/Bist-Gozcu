import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useStocks } from "./StockContext";
import { DataFreshness } from "@/utils/yahooFinance";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: requested } = await Notifications.requestPermissionsAsync();
  return requested === "granted";
}

async function fireLocalNotification(alert: PriceAlert, price: number) {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  const directionText: Record<AlertType, string> = {
    above: "üzerine çıktı",
    below: "altına düştü",
    tp: "kar al seviyesine ulaştı",
    sl: "zarar durdur seviyesine ulaştı",
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${alert.symbol} uyarısı tetiklendi`,
      body: `${alert.symbol} ₺${price.toFixed(2)} ile hedef ₺${alert.targetPrice.toFixed(2)} ${directionText[alert.alertType]}.`,
      sound: Platform.OS === "ios" ? "default" : undefined,
    },
    trigger: null,
  });
}

export interface RadarNotificationCandidate {
  symbol: string;
  price: number;
  changePercent: number;
  teyitSayisi: number;
  teyitler: string[];
  radarDurumu: "gunluk_teyitli" | "gun_ici_izleme";
  veriKalitesi: DataFreshness;
}

const RADAR_NOTIFICATION_KEY = "bist_trend_radar_notifications_v1";

const localDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export async function fireRadarNotifications(
  candidates: RadarNotificationCandidate[],
): Promise<void> {
  const eligibleCandidates = candidates.filter(
    (candidate) =>
      candidate.radarDurumu === "gunluk_teyitli" &&
      (candidate.veriKalitesi === "fresh" ||
        candidate.veriKalitesi === "closed_reference"),
  );
  if (Platform.OS === "web" || eligibleCandidates.length === 0) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  let sentState: Record<string, { date: string; stage: number }> = {};
  try {
    const raw = await AsyncStorage.getItem(RADAR_NOTIFICATION_KEY);
    if (raw)
      sentState = JSON.parse(raw) as Record<
        string,
        { date: string; stage: number }
      >;
  } catch {
    sentState = {};
  }

  const today = localDateKey();
  for (const candidate of eligibleCandidates) {
    const stage = candidate.teyitSayisi >= 6 ? 6 : 5;
    const previous = sentState[candidate.symbol];
    if (previous?.date === today && previous.stage >= stage) continue;

    const reasons = candidate.teyitler
      .filter((reason) => reason.startsWith("✓"))
      .map((reason) => reason.replace(/^✓\s*/, ""))
      .slice(0, 2)
      .join(" · ");
    const change = `${candidate.changePercent >= 0 ? "+" : ""}${candidate.changePercent.toFixed(2)}%`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: stage === 6 ? "Güçlü Trend teyidi" : "Yeni Trend Radarı sinyali",
        body: `${candidate.symbol} ${change} · ${candidate.teyitSayisi}/6 teyit${reasons ? ` · ${reasons}` : ""}. İnceleme sinyalidir.`,
        sound: Platform.OS === "ios" ? "default" : undefined,
        data: { symbol: candidate.symbol, type: "trend-radar" },
      },
      trigger: null,
    });
    sentState[candidate.symbol] = { date: today, stage };
  }

  const entries = Object.entries(sentState).slice(-100);
  await AsyncStorage.setItem(
    RADAR_NOTIFICATION_KEY,
    JSON.stringify(Object.fromEntries(entries)),
  );
}

export type AlertType = "above" | "below" | "tp" | "sl";

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  alertType: AlertType;
  triggered: boolean;
  note: string;
  createdAt: number;
  triggeredAt?: number;
}

interface AlertContextType {
  alerts: PriceAlert[];
  triggeredAlerts: PriceAlert[];
  addAlert: (
    symbol: string,
    targetPrice: number,
    alertType: AlertType,
    note?: string,
  ) => void;
  removeAlert: (id: string) => void;
  clearTriggered: () => void;
  dismissTriggered: (id: string) => void;
}

const AlertContext = createContext<AlertContextType>({
  alerts: [],
  triggeredAlerts: [],
  addAlert: () => {},
  removeAlert: () => {},
  clearTriggered: () => {},
  dismissTriggered: () => {},
});

const STORAGE_KEY = "bist_alerts";

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<PriceAlert[]>([]);
  const { quotes } = useStocks();
  const prevChecked = useRef<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setAlerts(JSON.parse(raw));
    });
  }, []);

  const save = useCallback((data: PriceAlert[]) => {
    setAlerts(data);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  useEffect(() => {
    const newTriggered: PriceAlert[] = [];
    const updatedAlerts = alerts.map((alert) => {
      if (alert.triggered) return alert;
      const quote = quotes[alert.symbol];
      if (!quote) return alert;
      if (
        quote.freshness !== "fresh" &&
        quote.freshness !== "slightly_delayed" &&
        quote.freshness !== "closed_reference"
      )
        return alert;
      const price = quote.regularMarketPrice;
      const prev = prevChecked.current[alert.symbol];
      prevChecked.current[alert.symbol] = price;
      if (prev === undefined) return alert;

      let hit = false;
      if (alert.alertType === "above" && price >= alert.targetPrice) hit = true;
      if (alert.alertType === "below" && price <= alert.targetPrice) hit = true;
      if (alert.alertType === "tp" && price >= alert.targetPrice) hit = true;
      if (alert.alertType === "sl" && price <= alert.targetPrice) hit = true;

      if (hit) {
        const updated = { ...alert, triggered: true, triggeredAt: Date.now() };
        newTriggered.push(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        fireLocalNotification(updated, price);
        return updated;
      }
      return alert;
    });

    if (newTriggered.length > 0) {
      save(updatedAlerts);
      setTriggeredAlerts((prev) => [...prev, ...newTriggered]);
    }
  }, [quotes, alerts, save]);

  const addAlert = useCallback(
    (symbol: string, targetPrice: number, alertType: AlertType, note = "") => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
      save([
        ...alerts,
        {
          id,
          symbol,
          targetPrice,
          alertType,
          triggered: false,
          note,
          createdAt: Date.now(),
        },
      ]);
    },
    [alerts, save],
  );

  const removeAlert = useCallback(
    (id: string) => {
      save(alerts.filter((a) => a.id !== id));
    },
    [alerts, save],
  );

  const clearTriggered = useCallback(() => setTriggeredAlerts([]), []);

  const dismissTriggered = useCallback((id: string) => {
    setTriggeredAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        triggeredAlerts,
        addAlert,
        removeAlert,
        clearTriggered,
        dismissTriggered,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  return useContext(AlertContext);
}
