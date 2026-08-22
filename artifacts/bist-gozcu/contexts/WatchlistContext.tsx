import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_BIST_STOCKS, BIST30 } from "@/constants/bistStocks";

const VALID_SYMBOLS = new Set(ALL_BIST_STOCKS.map((s) => s.symbol.toUpperCase()));
const SYMBOL_PATTERN = /^[A-Z0-9]{3,6}$/;

const isSupportedSymbol = (symbol: string): boolean =>
  VALID_SYMBOLS.has(symbol) || SYMBOL_PATTERN.test(symbol);

const normalize = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .map((value) => String(value).trim().toUpperCase())
    .filter((symbol) => {
      if (!isSupportedSymbol(symbol) || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
};

interface WatchlistContextType {
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  reorder: (from: number, to: number) => void;
  ready: boolean;
}

const WatchlistContext = createContext<WatchlistContextType>({
  watchlist: [],
  addToWatchlist: () => {},
  removeFromWatchlist: () => {},
  isWatched: () => false,
  reorder: () => {},
  ready: false,
});

const STORAGE_KEY = "bist_watchlist";
const DEFAULT_WATCHLIST = BIST30.map((s) => s.symbol);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [ready, setReady] = useState(false);
  const watchlistRef = useRef<string[]>(DEFAULT_WATCHLIST);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!active) return;
      const parsed = raw ? normalize(JSON.parse(raw)) : normalize(DEFAULT_WATCHLIST);
      watchlistRef.current = parsed;
      setWatchlist(parsed);
      setReady(true);
    }).catch(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  const save = useCallback((data: string[]) => {
    const normalized = normalize(data);
    watchlistRef.current = normalized;
    setWatchlist(normalized);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, []);

  const addToWatchlist = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!isSupportedSymbol(normalizedSymbol) || watchlistRef.current.includes(normalizedSymbol)) return;
    save([...watchlistRef.current, normalizedSymbol]);
  }, [save]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    save(watchlistRef.current.filter((s) => s !== normalizedSymbol));
  }, [save]);

  const isWatched = useCallback((symbol: string) => watchlistRef.current.includes(symbol.trim().toUpperCase()), []);

  const reorder = useCallback((from: number, to: number) => {
    const newList = [...watchlistRef.current];
    if (from < 0 || to < 0 || from >= newList.length || to >= newList.length) return;
    const [moved] = newList.splice(from, 1);
    newList.splice(to, 0, moved);
    save(newList);
  }, [save]);

  return (
    <WatchlistContext.Provider
      value={{ watchlist, addToWatchlist, removeFromWatchlist, isWatched, reorder, ready }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  return useContext(WatchlistContext);
}
