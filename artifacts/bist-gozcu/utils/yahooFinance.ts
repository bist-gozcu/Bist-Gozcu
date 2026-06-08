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

import { Platform } from "react-native";

function getProxyBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "";
}

const YF_DIRECT = "https://query2.finance.yahoo.com";
const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
};

let cachedCrumb: string | null = null;

async function getCrumb(): Promise<string | null> {
  if (cachedCrumb) return cachedCrumb;
  try {
    const res = await fetch(
      `${YF_DIRECT}/v1/test/getcrumb`,
      { headers: YF_HEADERS }
    );
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes("<") && text.length < 20) {
        cachedCrumb = text.trim();
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
      const symbolsStr = symbols.join(",");
      const url = `${proxyBase}/bist/quotes?symbols=${symbolsStr}`;
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
    const fields = [
      "regularMarketPrice", "regularMarketChangePercent", "regularMarketChange",
      "regularMarketVolume", "regularMarketPreviousClose", "regularMarketOpen",
      "regularMarketDayHigh", "regularMarketDayLow", "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow", "marketCap", "averageDailyVolume3Month", "shortName",
    ].join(",");
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
    const url = `${YF_DIRECT}/v7/finance/quote?symbols=${yahooSymbols}&fields=${fields}${crumbParam}`;
    const res = await fetch(url, { headers: YF_HEADERS });
    const json = await res.json() as Record<string, Record<string, QuoteData[]>>;
    const results = json?.quoteResponse?.result ?? [];
    return results.map((q) => ({ ...q, symbol: q.symbol.replace(".IS", "") }));
  } catch {
    return [];
  }
}

export async function fetchChartData(
  symbol: string,
  range: "1mo" | "3mo" | "6mo" | "1y" = "3mo"
): Promise<ChartResult | null> {
  try {
    const proxyBase = getProxyBase();
    let json: unknown;

    if (proxyBase) {
      try {
        const url = `${proxyBase}/bist/chart/${symbol}?range=${range}`;
        const res = await fetch(url);
        if (res.ok) {
          json = await res.json();
        }
      } catch {}
    }

    if (!json) {
      const crumb = await getCrumb();
      const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
      const url = `${YF_DIRECT}/v8/finance/chart/${symbol}.IS?interval=1d&range=${range}${crumbParam}`;
      const res = await fetch(url, { headers: YF_HEADERS });
      json = await res.json();
    }

    const chart = (json as Record<string, Record<string, Array<Record<string, unknown>>>>)
      ?.chart?.result?.[0];
    if (!chart) return null;

    const timestamps: number[] = (chart.timestamp as number[]) ?? [];
    const quote = (chart.indicators as Record<string, Array<Record<string, (number | null)[]>>>)
      ?.quote?.[0] ?? {};
    const closes: number[] = (quote.close ?? []).map((v) => v ?? 0);
    const opens: number[] = (quote.open ?? []).map((v) => v ?? 0);
    const highs: number[] = (quote.high ?? []).map((v) => v ?? 0);
    const lows: number[] = (quote.low ?? []).map((v) => v ?? 0);
    const volumes: number[] = (quote.volume ?? []).map((v) => v ?? 0);

    return { symbol: symbol.replace(".IS", ""), timestamps, closes, opens, highs, lows, volumes };
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
  const timeNum = hour * 100 + min;
  if (day === 0 || day === 6) return false;
  return timeNum >= 1000 && timeNum < 1800;
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
