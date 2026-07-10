import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PortfolioEntry {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  note: string;
  addedAt: number;
}

interface PortfolioContextType {
  entries: PortfolioEntry[];
  addEntry: (symbol: string, quantity: number, avgPrice: number, note?: string) => void;
  updateEntry: (id: string, quantity: number, avgPrice: number, note?: string) => void;
  removeEntry: (id: string) => void;
  getEntry: (symbol: string) => PortfolioEntry | undefined;
  totalCost: (prices: Record<string, number>) => number;
  totalValue: (prices: Record<string, number>) => number;
  reorder: (from: number, to: number) => void;
}

const PortfolioContext = createContext<PortfolioContextType>({
  entries: [],
  addEntry: () => {},
  updateEntry: () => {},
  removeEntry: () => {},
  getEntry: () => undefined,
  totalCost: () => 0,
  totalValue: () => 0,
  reorder: () => {},
});

const STORAGE_KEY = "bist_portfolio";

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setEntries(JSON.parse(raw));
    });
  }, []);

  const save = useCallback((data: PortfolioEntry[]) => {
    setEntries(data);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const addEntry = useCallback((symbol: string, quantity: number, avgPrice: number, note = "") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    save([...entries, { id, symbol: symbol.toUpperCase(), quantity, avgPrice, note, addedAt: Date.now() }]);
  }, [entries, save]);

  const updateEntry = useCallback((id: string, quantity: number, avgPrice: number, note?: string) => {
    save(entries.map((e) => e.id === id ? { ...e, quantity, avgPrice, note: note ?? e.note } : e));
  }, [entries, save]);

  const removeEntry = useCallback((id: string) => {
    save(entries.filter((e) => e.id !== id));
  }, [entries, save]);

  const getEntry = useCallback((symbol: string) => {
    return entries.find((e) => e.symbol === symbol.toUpperCase());
  }, [entries]);

  const totalCost = useCallback((prices: Record<string, number>) => {
    return entries.reduce((sum, e) => sum + e.quantity * e.avgPrice, 0);
  }, [entries]);

  const totalValue = useCallback((prices: Record<string, number>) => {
    return entries.reduce((sum, e) => {
      const price = prices[e.symbol] ?? e.avgPrice;
      return sum + e.quantity * price;
    }, 0);
  }, [entries]);

  const reorder = useCallback((from: number, to: number) => {
    const newList = [...entries];
    const [moved] = newList.splice(from, 1);
    newList.splice(to, 0, moved);
    save(newList);
  }, [entries, save]);

  return (
    <PortfolioContext.Provider value={{ entries, addEntry, updateEntry, removeEntry, getEntry, totalCost, totalValue, reorder }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
