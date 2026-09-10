import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { UNIQUE_BIST_STOCKS } from "@/constants/bistStocks";
import { fetchBatchQuotes, isBistOpen, QuoteData } from "@/utils/yahooFinance";
import { logger } from "@/utils/logger";

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

/** Sadece görünür sekmelerdeki sembolleri yenile — ağ trafiğini azaltır */
function getVisibleSymbols(
  allSymbols: string[],
  favorites: string[],
  watchlist: string[],
): string[] {
  const priority = new Set([...favorites, ...watchlist]);
  if (priority.size > 0) {
    // Önce favori + watchlist, sonra geri kalanı
    const primary = allSymbols.filter((s) => priority.has(s));
    const secondary = allSymbols.filter((s) => !priority.has(s));
    return [...primary, ...secondary];
  }
  return allSymbols;
}

export function StockProvider({ children }: { children: React.ReactNode }) {
  const { favorites } = useFavorites();
  const { watchlist } = useWatchlist();
  const allSymbols = useMemo(
    () => Array.from(new Set([
      ...UNIQUE_BIST_STOCKS.map((stock) => stock.symbol),
      ...favorites,
      ...watchlist,
    ])),
    [favorites, watchlist],
  );
  const trackedSymbols = useMemo(
    () => getVisibleSymbols(allSymbols, favorites, watchlist),
    [allSymbols, favorites, watchlist],
  );
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(isBistOpen());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Gereksiz yenilemeyi önlemek için son yenileme zamanını takip et
  const lastRefreshRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 10_000; // 10 saniye minimum yenileme aralığı

  const loadCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        setQuotes(data);
        setLastUpdated(new Date(ts));
      }
    } catch (e) {
      logger.warn("StockContext", "Önbellek yükleme hatası", e);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Minimum yenileme aralığını zorla — gereksiz API isteklerini önle
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL) return;
    lastRefreshRef.current = now;

    setLoading(true);
    setIsMarketOpen(isBistOpen());
    try {
      const symbols = trackedSymbols;
      const results = await fetchBatchQuotes(symbols);
      const map: Record<string, StockQuote> = {};
      for (const q of results) {
        map[q.symbol] = q as StockQuote;
      }
      setQuotes((prev) => ({ ...prev, ...map }));
      const updatedAt = new Date();
      setLastUpdated(updatedAt);
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: map, ts: updatedAt.getTime() })
      );
    } catch (e) {
      logger.error("StockContext", "Fiyat yenileme hatası", e);
      await loadCache();
    } finally {
      setLoading(false);
    }
  }, [loadCache, trackedSymbols]);

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

    // Piyasa açıkken 30 saniyede bir, kapalıyken 5 dakikada bir yenile
    const getRefreshInterval = () => isBistOpen() ? 30000 : 300000;

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (isBistOpen()) refresh();
      }, getRefreshInterval());
    };

    startTimer();

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