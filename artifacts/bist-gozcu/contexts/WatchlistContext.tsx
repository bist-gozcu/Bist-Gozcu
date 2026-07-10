import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_BIST_STOCKS, BIST30 } from "@/constants/bistStocks";

const VALID_SYMBOLS = new Set(ALL_BIST_STOCKS.map((s) => s.symbol));

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        setWatchlist(parsed.filter((s) => VALID_SYMBOLS.has(s)));
      } else {
        setWatchlist(DEFAULT_WATCHLIST);
      }
      setReady(true);
    });
  }, []);

  const save = useCallback((data: string[]) => {
    setWatchlist(data);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      if (prev.includes(symbol)) return prev;
      const next = [...prev, symbol];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== symbol);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWatched = useCallback((symbol: string) => watchlist.includes(symbol), [watchlist]);

  const reorder = useCallback((from: number, to: number) => {
    const newList = [...watchlist];
    const [moved] = newList.splice(from, 1);
    newList.splice(to, 0, moved);
    save(newList);
  }, [watchlist, save]);

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
