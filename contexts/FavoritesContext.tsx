import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { createContext, useContext } from "react";
import { ALL_BIST_STOCKS } from "@/constants/bistStocks";

const VALID_SYMBOLS = new Set(ALL_BIST_STOCKS.map((stock) => stock.symbol));
const SYMBOL_PATTERN = /^[A-Z0-9]{3,6}$/;

const isSupportedSymbol = (symbol: string): boolean =>
  VALID_SYMBOLS.has(symbol) || SYMBOL_PATTERN.test(symbol);
const STORAGE_KEY = "bist_favorites_v2";
const LEGACY_STORAGE_KEY = "bist_favorites";

interface FavoritesContextType {
  favorites: string[];
  addFavorite: (symbol: string) => void;
  removeFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
  reorder: (from: number, to: number) => void;
  ready: boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
  reorder: () => {},
  ready: false,
});

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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const favoritesRef = useRef<string[]>([]);
  const localMutationRef = useRef(0);

  const persist = useCallback((next: string[]) => {
    const normalized = normalize(next);
    favoritesRef.current = normalized;
    setFavorites(normalized);
    localMutationRef.current += 1;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)).catch(() => {
      // Depolama kullanılamazsa favoriler en azından mevcut oturumda korunur.
    });
  }, []);

  useEffect(() => {
    let active = true;
    const mutationAtStart = localMutationRef.current;

    const hydrate = async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        }
        const stored = raw ? normalize(JSON.parse(raw)) : [];

        // Kullanıcı veri okunurken yıldız işaretlediyse, geç gelen eski kayıt
        // bu yeni işlemi ezemez.
        if (active && localMutationRef.current === mutationAtStart) {
          favoritesRef.current = stored;
          setFavorites(stored);
          if (raw && !await AsyncStorage.getItem(STORAGE_KEY)) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
          }
        }
      } catch {
        // Bozuk veya kullanılamayan depolama uygulamayı durdurmaz.
      } finally {
        if (active) setReady(true);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const addFavorite = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!isSupportedSymbol(normalizedSymbol) || favoritesRef.current.includes(normalizedSymbol)) return;
    persist([...favoritesRef.current, normalizedSymbol]);
  }, [persist]);

  const removeFavorite = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    persist(favoritesRef.current.filter((item) => item !== normalizedSymbol));
  }, [persist]);

  const isFavorite = useCallback((symbol: string) => {
    return favoritesRef.current.includes(symbol.trim().toUpperCase());
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    const next = [...favoritesRef.current];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  }, [persist]);

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, reorder, ready }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
