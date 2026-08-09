// Dosya: services/collectApi.ts

import { ALL_BIST_STOCKS } from "@/constants/bistStocks";

export type Hisse = {
  sembol: string;
  fiyat: number;
  degisimYuzde: number;
  hacim: number;
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
};

type QuoteResponse = {
  quoteResponse?: {
    result?: QuoteRecord[];
  };
};

const getApiBase = (): string => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
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

export const getBist100 = async (): Promise<Hisse[]> => {
  const symbols = ALL_BIST_STOCKS.map((stock) => stock.symbol).join(",");
  const response = await fetch(
    `${getApiBase()}/bist/quotes?symbols=${encodeURIComponent(symbols)}`,
  );

  if (!response.ok) {
    throw new Error(`Piyasa verisi alınamadı (${response.status})`);
  }

  const payload = (await response.json()) as QuoteResponse;
  return (payload.quoteResponse?.result ?? [])
    .map((quote) => ({
      sembol: String(quote.symbol ?? "").replace(".IS", "").toUpperCase(),
      fiyat: parseTRNumber(quote.regularMarketPrice as string | number | null | undefined),
      degisimYuzde: parseTRNumber(
        quote.regularMarketChangePercent as string | number | null | undefined,
      ),
      hacim: parseTRNumber(quote.regularMarketVolume as string | number | null | undefined),
    }))
    .filter((quote) => quote.sembol.length > 0 && quote.fiyat > 0);
};

export const fetchHisseTemelDetay = async (
  _sembol: string,
): Promise<TemelVeri> => {
  return { fk: null, pddd: null };
};