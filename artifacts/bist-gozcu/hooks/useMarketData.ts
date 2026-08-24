// Dosya: hooks/useMarketData.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBist100, Hisse } from "@/services/collectApi";
import {
  classifyDataFreshness,
  getFreshnessWarning,
} from "@/utils/yahooFinance";
import { isPiyasaAcik } from "@/utils/seansKontrol";

const OPEN_MARKET_CACHE_TTL = 2 * 60 * 1000;
const CLOSED_MARKET_CACHE_TTL = 15 * 60 * 1000;

const getCacheTtl = (): number =>
  isPiyasaAcik() ? OPEN_MARKET_CACHE_TTL : CLOSED_MARKET_CACHE_TTL;

type CacheEnvelope = {
  data: Hisse[];
  ts: number;
};

const getCacheKey = (endpoint: string): string =>
  `market_data_cache:${endpoint}`;

const withCacheFreshness = (
  data: Hisse[],
  cachedAt: number,
  expired: boolean,
): Hisse[] =>
  data.map((item) => {
    const rawPiyasaZamani = item.piyasaZamani;
    const piyasaZamani =
      rawPiyasaZamani != null &&
      Number.isFinite(rawPiyasaZamani) &&
      rawPiyasaZamani > 0
        ? rawPiyasaZamani
        : null;
    const freshness = expired
      ? ("stale" as const)
      : classifyDataFreshness(piyasaZamani, Date.now(), isPiyasaAcik());
    return {
      ...item,
      piyasaZamani,
      veriCekilmeZamani: item.veriCekilmeZamani || cachedAt,
      veriKalitesi: freshness,
      veriKaynagi: item.veriKaynagi || "Yerel cache",
      veriUyarisi: getFreshnessWarning(freshness),
    };
  });

const fetchEndpoint = async (endpoint: string): Promise<Hisse[]> => {
  if (endpoint === "bist100") return getBist100();

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Veri alınamadı (${response.status})`);
  const payload = (await response.json()) as Hisse[];
  if (!Array.isArray(payload)) throw new Error("Geçersiz piyasa verisi");
  return payload;
};

const readCache = async (
  endpoint: string,
  allowExpired: boolean,
): Promise<Hisse[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(endpoint));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(cached.data) || typeof cached.ts !== "number")
      return null;
    const expired = Date.now() - cached.ts > getCacheTtl();
    if (allowExpired || !expired)
      return withCacheFreshness(cached.data, cached.ts, expired);
  } catch {
    return null;
  }
  return null;
};

export const useMarketData = (endpoint: string) => {
  const queryClient = useQueryClient();
  const marketOpen = isPiyasaAcik();
  const cacheTtl = marketOpen ? OPEN_MARKET_CACHE_TTL : CLOSED_MARKET_CACHE_TTL;
  const query = useQuery<Hisse[], Error>({
    queryKey: ["market-data", endpoint],
    staleTime: cacheTtl,
    gcTime: cacheTtl,
    refetchInterval: marketOpen ? OPEN_MARKET_CACHE_TTL : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const freshCache = await readCache(endpoint, false);
      if (freshCache) return freshCache;

      try {
        const data = await fetchEndpoint(endpoint);
        await AsyncStorage.setItem(
          getCacheKey(endpoint),
          JSON.stringify({ data, ts: Date.now() } satisfies CacheEnvelope),
        );
        return data;
      } catch (error) {
        const lastSuccessfulData = await readCache(endpoint, true);
        if (lastSuccessfulData) return lastSuccessfulData;
        throw error;
      }
    },
  });

  const manuelYenile = async (): Promise<void> => {
    await AsyncStorage.removeItem(getCacheKey(endpoint));
    await queryClient.invalidateQueries({
      queryKey: ["market-data", endpoint],
    });
    await query.refetch();
  };

  return { ...query, manuelYenile };
};
