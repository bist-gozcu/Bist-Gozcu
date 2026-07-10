import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_BIST_STOCKS } from "@/constants/bistStocks";

const VALID_SYMBOLS = new Set(ALL_BIST_STOCKS.map((s) => s.symbol));

interface FavoritesContextType {
  favorites: string[];
  addFavorite: (symbol: string) => void;
  removeFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
  reorder: (from: number, to: number) => void;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
  reorder: () => {},
});

const STORAGE_KEY = "bist_favorites";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        setFavorites(parsed.filter((s) => VALID_SYMBOLS.has(s)));
      }
    });
  }, []);

  const save = useCallback((data: string[]) => {
    setFavorites(data);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const addFavorite = useCallback((symbol: string) => {
    if (!favorites.includes(symbol)) {
      save([...favorites, symbol]);
    }
  }, [favorites, save]);

  const removeFavorite = useCallback((symbol: string) => {
    save(favorites.filter((s) => s !== symbol));
  }, [favorites, save]);

  const isFavorite = useCallback((symbol: string) => {
    return favorites.includes(symbol);
  }, [favorites]);

  const reorder = useCallback((from: number, to: number) => {
    const newList = [...favorites];
    const [moved] = newList.splice(from, 1);
    newList.splice(to, 0, moved);
    save(newList);
  }, [favorites, save]);

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, reorder }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
