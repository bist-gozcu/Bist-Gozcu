import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { ALL_BIST_STOCKS } from "@/constants/bistStocks";
import { fetchBatchQuotes, isBistOpen, QuoteData } from "@/utils/yahooFinance";

export interface StockQuote extends QuoteData {
  symbol: string;
}

interface StockContextType {
  quotes: Record<string, StockQuote>;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  isMarketOpen: boolean;
}

const StockContext = createContext<StockContextType>({
  quotes: {},
  loading: false,
  lastUpdated: null,
  refresh: async () => {},
  isMarketOpen: false,
});

const CACHE_KEY = "bist_quotes_cache";
const CACHE_TTL = 60 * 1000;

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(isBistOpen());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const loadCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        setQuotes(data);
        setLastUpdated(new Date(ts));
      }
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setIsMarketOpen(isBistOpen());
    try {
      const symbols = ALL_BIST_STOCKS.map((s) => s.symbol);
      const CHUNK_SIZE = 25;
      const chunks: string[][] = [];
      for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
        chunks.push(symbols.slice(i, i + CHUNK_SIZE));
      }
      const chunkResults = await Promise.all(chunks.map((c) => fetchBatchQuotes(c)));
      const results = chunkResults.flat();
      const map: Record<string, StockQuote> = {};
      for (const q of results) {
        map[q.symbol] = q as StockQuote;
      }
      setQuotes((prev) => ({ ...prev, ...map }));
      const now = new Date();
      setLastUpdated(now);
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: map, ts: now.getTime() })
      );
    } catch (e) {
      await loadCache();
    } finally {
      setLoading(false);
    }
  }, [loadCache]);

  useEffect(() => {
    loadCache().then(() => refresh());

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        state === "active"
      ) {
        refresh();
      }
      appStateRef.current = state;
    });

    timerRef.current = setInterval(() => {
      if (isBistOpen()) refresh();
    }, 30000);

    return () => {
      sub.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadCache, refresh]);

  return (
    <StockContext.Provider value={{ quotes, loading, lastUpdated, refresh, isMarketOpen }}>
      {children}
    </StockContext.Provider>
  );
}

export function useStocks() {
  return useContext(StockContext);
}
