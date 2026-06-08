export interface QuoteData {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketChange: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  averageDailyVolume3Month: number;
}

export interface ChartResult {
  symbol: string;
  timestamps: number[];
  closes: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

export type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y";

import { Platform } from "react-native";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9",
};

const RANGE_INTERVAL: Record<ChartRange, string> = {
  "1d": "5m",
  "5d": "1h",
  "1mo": "1d",
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
};

function getProxyBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "";
}

let cachedCrumb: string | null = null;
let crumbFetchTime = 0;

async function getCrumb(): Promise<string | null> {
  if (cachedCrumb && Date.now() - crumbFetchTime < 3600000) return cachedCrumb;
  try {
    const res = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: YF_HEADERS,
    });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes("<") && text.length < 30) {
        cachedCrumb = text.trim();
        crumbFetchTime = Date.now();
        return cachedCrumb;
      }
    }
  } catch {}
  return null;
}

export async function fetchBatchQuotes(symbols: string[]): Promise<QuoteData[]> {
  const proxyBase = getProxyBase();

  if (proxyBase) {
    try {
      const url = `${proxyBase}/bist/quotes?symbols=${symbols.join(",")}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json() as Record<string, Record<string, QuoteData[]>>;
        const results = json?.quoteResponse?.result ?? [];
        return results.map((q) => ({ ...q, symbol: q.symbol.replace(".IS", "") }));
      }
    } catch {}
  }

  try {
    const crumb = await getCrumb();
    const yahooSymbols = symbols.map((s) => `${s}.IS`).join(",");
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange,regularMarketVolume,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,averageDailyVolume3Month,shortName${crumbParam}`;
    const res = await fetch(url, { headers: YF_HEADERS });
    const json = await res.json() as Record<string, Record<string, QuoteData[]>>;
    const results = json?.quoteResponse?.result ?? [];
    return results.map((q) => ({ ...q, symbol: q.symbol.replace(".IS", "") }));
  } catch {
    return [];
  }
}

function parseChartJson(json: unknown, sym: string): ChartResult | null {
  const chart = (json as Record<string, Record<string, Array<Record<string, unknown>>>>)
    ?.chart?.result?.[0];
  if (!chart) return null;

  const timestamps: number[] = (chart.timestamp as number[]) ?? [];
  const quote = (chart.indicators as Record<string, Array<Record<string, (number | null)[]>>>)
    ?.quote?.[0] ?? {};

  const clean = (arr: (number | null)[] | undefined): number[] =>
    (arr ?? []).map((v) => (v == null || isNaN(v as number) ? 0 : (v as number)));

  return {
    symbol: sym.replace(".IS", ""),
    timestamps,
    closes: clean(quote.close),
    opens: clean(quote.open),
    highs: clean(quote.high),
    lows: clean(quote.low),
    volumes: clean(quote.volume),
  };
}

export async function fetchChartData(
  symbol: string,
  range: ChartRange = "3mo"
): Promise<ChartResult | null> {
  const interval = RANGE_INTERVAL[range];
  const proxyBase = getProxyBase();

  if (proxyBase) {
    try {
      const url = `${proxyBase}/bist/chart/${symbol}?range=${range}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const result = parseChartJson(json, symbol);
        if (result) return result;
      }
    } catch {}
  }

  try {
    const v8url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${interval}&range=${range}&includePrePost=false`;
    const res = await fetch(v8url, { headers: YF_HEADERS });
    if (res.ok) {
      const json = await res.json();
      const result = parseChartJson(json, symbol);
      if (result) return result;
    }
  } catch {}

  try {
    const crumb = await getCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${interval}&range=${range}${crumbParam}`;
    const res = await fetch(url, { headers: YF_HEADERS });
    const json = await res.json();
    return parseChartJson(json, symbol);
  } catch {
    return null;
  }
}

export function isBistOpen(): boolean {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const day = istanbul.getDay();
  const hour = istanbul.getHours();
  const min = istanbul.getMinutes();
  const t = hour * 100 + min;
  if (day === 0 || day === 6) return false;
  return t >= 1000 && t < 1800;
}

export function getMarketSession(): "pre" | "open" | "post" | "closed" {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const day = istanbul.getDay();
  if (day === 0 || day === 6) return "closed";
  const hour = istanbul.getHours();
  const min = istanbul.getMinutes();
  const t = hour * 100 + min;
  if (t < 930) return "closed";
  if (t < 1000) return "pre";
  if (t < 1800) return "open";
  if (t < 1830) return "post";
  return "closed";
}
