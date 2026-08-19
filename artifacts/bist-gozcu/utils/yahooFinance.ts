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
export type IntradayInterval = "5m" | "10m" | "15m" | "60m";

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

const QUOTE_TIMEOUT_MS = 8_000;
const QUOTE_BATCH_DEADLINE_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = QUOTE_TIMEOUT_MS,
): Promise<Response> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const requestInit: RequestInit = controller
    ? { ...init, signal: controller.signal }
    : init;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`İstek zaman aşımına uğradı: ${url}`));
    }, timeoutMs);
  });
  try {
    // Promise.race, Android fetch abort’u gecikse bile üst katmanın beklemesini engeller.
    return await Promise.race([fetch(url, requestInit), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const PERMANENT_PROXY_BASE = "https://bist-gozcu--careki73.replit.app/api";

function getProxyBase(): string {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  // Android’da EAS ortam değişkeni boş veya eski olsa bile kalıcı proxy kesin kullanılır.
  if (!configuredDomain || configuredDomain === "bist-gozcu--careki73.replit.app") {
    return PERMANENT_PROXY_BASE;
  }
  return `https://${configuredDomain}/api`;
}

let cachedCrumb: string | null = null;
let crumbFetchTime = 0;

async function getCrumb(): Promise<string | null> {
  if (cachedCrumb && Date.now() - crumbFetchTime < 3600000) return cachedCrumb;
  try {
    const res = await fetchWithTimeout("https://query1.finance.yahoo.com/v1/test/getcrumb", {
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

type YahooChartQuote = {
  chart?: {
    result?: Array<{
      meta?: Record<string, unknown>;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

async function fetchQuoteFromChart(symbol: string, timeoutMs = QUOTE_TIMEOUT_MS): Promise<QuoteData | null> {
  try {
    const yahooSymbol = `${symbol.replace(".IS", "").toUpperCase()}.IS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo&includePrePost=false`;
    // Android OkHttp bazı sürümlerde tarayıcı User-Agent başlığını reddedebiliyor.
    const res = await fetchWithTimeout(url, undefined, timeoutMs);
    if (!res.ok) return null;

    const json = await res.json() as YahooChartQuote;
    const result = json.chart?.result?.[0];
    const meta = result?.meta ?? {};
    const quote = result?.indicators?.quote?.[0] ?? {};
    const closes = quote.close ?? [];
    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const volumes = quote.volume ?? [];
    const validIndexes = closes
      .map((close, index) => (typeof close === "number" && close > 0 ? index : -1))
      .filter((index) => index >= 0);
    const lastIndex = validIndexes.at(-1);
    if (lastIndex == null) return null;

    const price = asNumber(meta.regularMarketPrice) || asNumber(closes[lastIndex]);
    const previousClose =
      asNumber(meta.chartPreviousClose) ||
      asNumber(closes[validIndexes.at(-2) ?? lastIndex]);
    const change = price - previousClose;
    const averageVolume = volumes
      .map(asNumber)
      .filter((volume) => volume > 0)
      .reduce((sum, volume, _, values) => sum + volume / values.length, 0);

    return {
      symbol: symbol.replace(".IS", "").toUpperCase(),
      shortName: String(meta.shortName ?? meta.longName ?? symbol),
      regularMarketPrice: price,
      regularMarketChangePercent: previousClose ? (change / previousClose) * 100 : 0,
      regularMarketChange: change,
      regularMarketVolume: asNumber(meta.regularMarketVolume) || asNumber(volumes[lastIndex]),
      regularMarketPreviousClose: previousClose,
      regularMarketOpen: asNumber(opens[lastIndex]),
      regularMarketDayHigh: asNumber(meta.regularMarketDayHigh) || asNumber(highs[lastIndex]),
      regularMarketDayLow: asNumber(meta.regularMarketDayLow) || asNumber(lows[lastIndex]),
      fiftyTwoWeekHigh: asNumber(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: asNumber(meta.fiftyTwoWeekLow),
      marketCap: asNumber(meta.marketCap),
      // Quote endpoint’i kapalı olduğunda 5 günlük chart hacmi güvenli yaklaşık değerdir.
      averageDailyVolume3Month: averageVolume,
    };
  } catch {
    return null;
  }
}

async function fetchQuotesFromChart(symbols: string[]): Promise<QuoteData[]> {
  const results: QuoteData[] = [];
  const concurrency = 4;
  const deadline = Date.now() + QUOTE_BATCH_DEADLINE_MS;
  for (let i = 0; i < symbols.length && Date.now() < deadline; i += concurrency) {
    const remaining = deadline - Date.now();
    const batch = await Promise.all(
      symbols.slice(i, i + concurrency).map((symbol) =>
        fetchQuoteFromChart(symbol, Math.min(QUOTE_TIMEOUT_MS, remaining)),
      ),
    );
    results.push(...batch.filter((quote): quote is QuoteData => quote !== null));
  }
  return results;
}

const PROXY_CHUNK_SIZE = 24;
const PROXY_TIMEOUT_MS = 20_000;
const PROXY_RETRIES = 2;

function normalizeProxyResults(payload: unknown): QuoteData[] {
  const root = payload as { quoteResponse?: { result?: Array<Record<string, unknown>> } };
  const rawResults = Array.isArray(root?.quoteResponse?.result)
    ? root.quoteResponse.result
    : [];

  return rawResults
    .map((q) => {
      const rawSymbol = typeof q.symbol === "string" ? q.symbol : "";
      const symbol = rawSymbol.replace(/\.IS$/i, "").toUpperCase();
      return {
        ...q,
        symbol,
        regularMarketPrice: Number(q.regularMarketPrice) || 0,
        regularMarketChangePercent: Number(q.regularMarketChangePercent) || 0,
        regularMarketChange: Number(q.regularMarketChange) || 0,
        regularMarketVolume: Number(q.regularMarketVolume) || 0,
        regularMarketPreviousClose: Number(q.regularMarketPreviousClose) || 0,
        regularMarketOpen: Number(q.regularMarketOpen) || 0,
        regularMarketDayHigh: Number(q.regularMarketDayHigh) || 0,
        regularMarketDayLow: Number(q.regularMarketDayLow) || 0,
        fiftyTwoWeekHigh: Number(q.fiftyTwoWeekHigh) || 0,
        fiftyTwoWeekLow: Number(q.fiftyTwoWeekLow) || 0,
        marketCap: Number(q.marketCap) || 0,
        averageDailyVolume3Month: Number(q.averageDailyVolume3Month) || 0,
      } as QuoteData;
    })
    .filter((q) => q.symbol.length > 0 && q.regularMarketPrice > 0);
}

async function fetchProxyChunk(proxyBase: string, symbols: string[]): Promise<QuoteData[]> {
  const url = `${proxyBase}/bist/quotes?symbols=${symbols.join(",")}`;
  for (let attempt = 0; attempt < PROXY_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, undefined, PROXY_TIMEOUT_MS);
      if (!res.ok) continue;
      const results = normalizeProxyResults(await res.json());
      if (results.length > 0) return results;
    } catch {
      // Replit free deployment may need one retry after waking from sleep.
    }
  }
  return [];
}

export async function fetchBatchQuotes(symbols: string[]): Promise<QuoteData[]> {
  const proxyBase = getProxyBase();

  if (proxyBase) {
    const proxyResults: QuoteData[] = [];
    for (let i = 0; i < symbols.length; i += PROXY_CHUNK_SIZE) {
      const chunkResults = await fetchProxyChunk(
        proxyBase,
        symbols.slice(i, i + PROXY_CHUNK_SIZE),
      );
      proxyResults.push(...chunkResults);
    }
    if (proxyResults.length > 0) return proxyResults;
  }

  // Yahoo’nun v7 quote endpoint’i bazı ağlarda 401 döndürüyor. Chart endpoint’i
  // mobil cihazlarda çalıştığı için son güvenli fallback olarak kullanılır.
  return fetchQuotesFromChart(symbols);
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

function aggregateCandles(data: ChartResult, groupSize: number): ChartResult {
  if (groupSize <= 1) return data;
  const timestamps: number[] = [];
  const closes: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];

  for (let i = 0; i < data.closes.length; i += groupSize) {
    const end = Math.min(i + groupSize, data.closes.length);
    const slice = { c: data.closes.slice(i, end), o: data.opens.slice(i, end), h: data.highs.slice(i, end), l: data.lows.slice(i, end), v: data.volumes.slice(i, end) };
    const validIdx = slice.c.map((c, idx) => (c > 0 ? idx : -1)).filter((idx) => idx >= 0);
    if (validIdx.length === 0) continue;
    timestamps.push(data.timestamps[i]);
    opens.push(slice.o[validIdx[0]] || slice.c[validIdx[0]]);
    closes.push(slice.c[validIdx[validIdx.length - 1]]);
    highs.push(Math.max(...validIdx.map((idx) => slice.h[idx] || slice.c[idx])));
    lows.push(Math.min(...validIdx.map((idx) => (slice.l[idx] > 0 ? slice.l[idx] : slice.c[idx]))));
    volumes.push(slice.v.reduce((s, v) => s + v, 0));
  }

  return { symbol: data.symbol, timestamps, closes, opens, highs, lows, volumes };
}

export async function fetchChartData(
  symbol: string,
  range: ChartRange = "3mo",
  intradayInterval?: IntradayInterval
): Promise<ChartResult | null> {
  const yahooInterval = range === "1d" && intradayInterval
    ? (intradayInterval === "10m" ? "5m" : intradayInterval)
    : RANGE_INTERVAL[range];
  const proxyBase = getProxyBase();

  const finish = (result: ChartResult | null): ChartResult | null => {
    if (result && range === "1d" && intradayInterval === "10m") {
      return aggregateCandles(result, 2);
    }
    return result;
  };

  if (proxyBase) {
    try {
      const url = `${proxyBase}/bist/chart/${symbol}?range=${range}&interval=${yahooInterval}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const result = parseChartJson(json, symbol);
        if (result) return finish(result);
      }
    } catch {}
  }

  try {
    const v8url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${yahooInterval}&range=${range}&includePrePost=false`;
    const res = await fetchWithTimeout(v8url, { headers: YF_HEADERS });
    if (res.ok) {
      const json = await res.json();
      const result = parseChartJson(json, symbol);
      if (result) return finish(result);
    }
  } catch {}

  try {
    const crumb = await getCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${yahooInterval}&range=${range}${crumbParam}`;
    const res = await fetchWithTimeout(url, { headers: YF_HEADERS });
    const json = await res.json();
    return finish(parseChartJson(json, symbol));
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
