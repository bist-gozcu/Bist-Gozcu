// Dosya: services/collectApi.ts

import { Platform } from "react-native";
import { UNIQUE_BIST_STOCKS } from "@/constants/bistStocks";
import { fetchBatchQuotes } from "@/utils/yahooFinance";

export type Hisse = {
  sembol: string;
  fiyat: number;
  degisimYuzde: number;
  hacim: number;
  /** Yahoo Finance üç aylık ortalama hacmi; bazı veri kaynaklarında bulunmayabilir. */
  ortalamaHacim?: number;
};

export type TemelVeri = {
  fk: number | null;
  pddd: number | null;
};

type QuoteRecord = {
  symbol?: unknown;
  regularMarketPrice?: unknown;
  regularMarketChangePercent?: unknown;
  regularMarketVolume?: unknown;
  averageDailyVolume3Month?: unknown;
};

type QuoteResponse = {
  quoteResponse?: {
    result?: QuoteRecord[];
  };
};

const getApiBase = (): string => {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  const domain = configuredDomain || "bist-gozcu--careki73.replit.app";
  if (domain) return `https://${domain}/api`;
  // Native APK da artık kalıcı HTTPS proxy kullanır; göreli /api yalnızca web için kullanılır.
  if (Platform.OS !== "web") return "";
  return "/api";
};

export const parseTRNumber = (
  value: string | number | undefined | null,
): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized) return 0;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let canonical = normalized;

  if (lastComma > lastDot) {
    canonical = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    canonical = normalized.replace(/,/g, "");
  }

  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeQuote = (quote: QuoteRecord): Hisse => ({
  sembol: String(quote.symbol ?? "").replace(".IS", "").toUpperCase(),
  fiyat: parseTRNumber(quote.regularMarketPrice as string | number | null | undefined),
  degisimYuzde: parseTRNumber(
    quote.regularMarketChangePercent as string | number | null | undefined,
  ),
  hacim: parseTRNumber(quote.regularMarketVolume as string | number | null | undefined),
  ortalamaHacim: parseTRNumber(
    quote.averageDailyVolume3Month as string | number | null | undefined,
  ),
});

const validQuotes = (quotes: Hisse[]): Hisse[] =>
  quotes.filter((quote) => quote.sembol.length > 0 && quote.fiyat > 0);

export const getBist100 = async (): Promise<Hisse[]> => {
  const stockSymbols = UNIQUE_BIST_STOCKS.map((stock) => stock.symbol);
  const symbols = stockSymbols.join(",");

  try {
    const response = await fetch(
      `${getApiBase()}/bist/quotes?symbols=${encodeURIComponent(symbols)}`,
    );
    const contentType = response.headers.get("content-type") ?? "";

    // Expo web dev sunucusu /api için HTML fallback döndürebilir. HTML’i
    // quote yanıtı gibi parse etmeyip doğrudan güvenli fallback’e geçiyoruz.
    if (response.ok && contentType.includes("application/json")) {
      const payload = (await response.json()) as QuoteResponse;
      const quotes = validQuotes((payload.quoteResponse?.result ?? []).map(normalizeQuote));
      if (quotes.length > 0) return quotes;
    }
  } catch {
    // Aşağıdaki public Yahoo fallback yolu denenir.
  }

  const fallbackQuotes = await fetchBatchQuotes(stockSymbols);
  return validQuotes(
    fallbackQuotes.map((quote) => normalizeQuote(quote as QuoteRecord)),
  );
};

export const fetchHisseTemelDetay = async (
  _sembol: string,
): Promise<TemelVeri> => {
  return { fk: null, pddd: null };
};