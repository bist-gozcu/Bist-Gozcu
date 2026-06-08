import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useStocks } from "./StockContext";

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
  addAlert: (symbol: string, targetPrice: number, alertType: AlertType, note?: string) => void;
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
        return updated;
      }
      return alert;
    });

    if (newTriggered.length > 0) {
      save(updatedAlerts);
      setTriggeredAlerts((prev) => [...prev, ...newTriggered]);
    }
  }, [quotes, alerts, save]);

  const addAlert = useCallback((symbol: string, targetPrice: number, alertType: AlertType, note = "") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    save([...alerts, { id, symbol, targetPrice, alertType, triggered: false, note, createdAt: Date.now() }]);
  }, [alerts, save]);

  const removeAlert = useCallback((id: string) => {
    save(alerts.filter((a) => a.id !== id));
  }, [alerts, save]);

  const clearTriggered = useCallback(() => setTriggeredAlerts([]), []);

  const dismissTriggered = useCallback((id: string) => {
    setTriggeredAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <AlertContext.Provider value={{ alerts, triggeredAlerts, addAlert, removeAlert, clearTriggered, dismissTriggered }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  return useContext(AlertContext);
}
